import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import {
  FALLBACK_MODEL,
  MODEL,
  anthropicErrorResponse,
  extractJson,
  isModelCapacityError,
  missingApiKeyResponse,
} from "@/lib/distillServer";
import { getUserAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { embedQuery, searchTeamBrainChunks, type MatchedChunk } from "@/lib/teamBrainSearch";
import type { TeamBrainChatCitation, TeamBrainChatRequestBody, TeamBrainChatResponseBody } from "@/lib/types";

export const maxDuration = 60;

// Le contexte (extraits récupérés) accompagne la question de CE tour dans
// le dernier message "user" reconstruit ci-dessous — jamais mis en cache
// comme dans le Mode Explication (@/app/api/distill/chat), puisqu'il change
// à chaque question (une nouvelle recherche vectorielle à chaque tour, le
// sujet pouvant dériver au fil de la conversation).
const SYSTEM_PROMPT = `Tu es l'assistant IA d'une équipe, qui répond aux questions de ses membres EXCLUSIVEMENT à partir des extraits de documents fournis dans la conversation — jamais à partir de connaissances générales externes, même si tu les connais. Si la réponse ne se trouve pas dans ces extraits, dis-le clairement plutôt que d'inventer ou de compléter avec des connaissances générales.
Pour chaque affirmation, cite le document et la page d'où elle vient, et reproduis mot pour mot le passage exact qui la justifie (sans le reformuler ni le résumer). Garde chaque citation courte (une phrase, jamais un paragraphe entier).
Réponds uniquement en JSON : {"answer": "...", "citations": [{"documentName": "...", "pageNumber": 3, "quote": "..."}]}. "pageNumber" vaut null si le document source n'a pas de pagination (une note). "citations" est un tableau vide si aucune citation directe n'appuie la réponse (par exemple si tu indiques que l'information est absente des extraits).`;

function isTeamBrainChatResponse(value: unknown): value is TeamBrainChatResponseBody {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.answer !== "string") return false;
  if (!Array.isArray(v.citations)) return false;
  return v.citations.every((c): c is TeamBrainChatCitation => {
    if (!c || typeof c !== "object") return false;
    const citation = c as Record<string, unknown>;
    return (
      typeof citation.documentName === "string" &&
      typeof citation.quote === "string" &&
      (citation.pageNumber === null || typeof citation.pageNumber === "number")
    );
  });
}

function buildContextBlock(chunks: MatchedChunk[]): string {
  return chunks
    .map((chunk, i) => {
      const location = chunk.pageNumber ? `${chunk.documentName}, page ${chunk.pageNumber}` : chunk.documentName;
      return `[Extrait ${i + 1} — ${location}]\n${chunk.chunkText}`;
    })
    .join("\n\n");
}

/** Chat Team Brain — recherche vectorielle (@/lib/teamBrainSearch) puis
 * génération d'une réponse strictement ancrée dans les documents de
 * l'équipe (étape 3/4, voir plan validé). Aucun suivi de coût/plafond sur
 * cette route pour l'instant : Team Brain n'a pas encore de facturation
 * réelle (décision explicite, voir plan validé). */
export async function POST(request: Request): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return missingApiKeyResponse();
  }

  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const body = (await request.json()) as TeamBrainChatRequestBody;
  const { projectId, question } = body;
  const history = Array.isArray(body.history) ? body.history : [];

  if (!projectId || !question?.trim()) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  // L'accès au projet passe par la lecture RLS ci-dessous (même principe
  // qu'à l'étape 2) ; la recherche elle-même hérite ensuite de RLS via
  // team_brain_match_chunks — voir @/lib/teamBrainSearch.
  const supabase = await createClient();
  const { data: project } = await supabase.from("team_brain_projects").select("id").eq("id", projectId).single();
  if (!project) {
    return NextResponse.json({ error: "Projet introuvable ou accès refusé." }, { status: 403 });
  }

  try {
    const queryEmbedding = await embedQuery(question);
    const matches = await searchTeamBrainChunks(supabase, projectId, queryEmbedding);

    if (matches.length === 0) {
      const empty: TeamBrainChatResponseBody = {
        answer: "Je ne trouve aucune information à ce sujet dans les documents de ce projet.",
        citations: [],
      };
      return NextResponse.json(empty);
    }

    const client = new Anthropic({ apiKey });
    const messages: Anthropic.MessageParam[] = [
      ...history.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: "user" as const, content: `${buildContextBlock(matches)}\n\nQuestion : ${question}` },
    ];

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({ model: MODEL, max_tokens: 2048, system: SYSTEM_PROMPT, messages });
    } catch (error) {
      if (!isModelCapacityError(error)) throw error;
      console.log(`Repli automatique ${MODEL} → ${FALLBACK_MODEL} (chat Team Brain) : contenu hors de portée du modèle par défaut.`);
      response = await client.messages.create({ model: FALLBACK_MODEL, max_tokens: 2048, system: SYSTEM_PROMPT, messages });
    }

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Le modèle n'a pas pu répondre à cette question. Essayez de la reformuler." },
        { status: 422 },
      );
    }
    if (response.stop_reason === "max_tokens") {
      return NextResponse.json(
        { error: "La réponse était trop longue et a été coupée. Reformulez votre question de façon plus précise." },
        { status: 502 },
      );
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Le modèle n'a renvoyé aucun contenu exploitable." }, { status: 502 });
    }

    let candidate: unknown;
    try {
      candidate = extractJson(textBlock.text);
    } catch {
      return NextResponse.json({ error: "La réponse du modèle n'a pas pu être interprétée. Réessayez." }, { status: 502 });
    }
    if (!isTeamBrainChatResponse(candidate)) {
      return NextResponse.json(
        { error: "La réponse du modèle ne correspond pas au format attendu. Réessayez." },
        { status: 502 },
      );
    }

    return NextResponse.json(candidate satisfies TeamBrainChatResponseBody);
  } catch (error) {
    return anthropicErrorResponse(error);
  }
}
