import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getUserAndProfile } from "@/lib/auth";
import {
  MODEL,
  anthropicErrorResponse,
  buildContentBlocks,
  deletePdfBlob,
  extractJson,
  fetchPdfFromBlob,
  missingApiKeyResponse,
  validateImageSize,
} from "@/lib/distillServer";
import type { ChatCitation, ChatRequestBody, ChatResponseBody } from "@/lib/types";

// Le contenu source (texte/photo/PDF) n'est jamais rappelé dans le prompt
// système : il est réinjecté dans le premier message "user" de la
// conversation reconstruite à chaque appel (voir plus bas), là où Claude
// s'attend normalement à voir des pièces jointes. Le prompt système ne
// porte que la consigne de comportement.
const SYSTEM_PROMPT = `Tu es un tuteur pédagogique qui répond aux questions d'un étudiant EXCLUSIVEMENT à partir des notes de cours fournies dans la conversation — jamais à partir de connaissances générales externes, même si tu les connais. Si la réponse ne se trouve pas dans ces notes, dis-le clairement plutôt que d'inventer ou de compléter avec des connaissances générales.
Pour chaque réponse, cite les passages exacts des notes qui la justifient : copie-les mot pour mot, sans les reformuler ni les résumer, afin qu'ils puissent être retrouvés tels quels dans le texte source.
Réponds uniquement en JSON : {"answer": "...", "citations": [{"quote": "..."}]}. "citations" est un tableau vide si aucune citation directe n'appuie la réponse (par exemple si tu indiques que l'information est absente des notes).`;

// Même marge que /api/distill : le PDF peut être volumineux et Claude doit
// le relire à chaque message (aucune mise en cache de prompt pour l'instant).
export const maxDuration = 300;

function isChatResponse(value: unknown): value is ChatResponseBody {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.answer !== "string") return false;
  if (!Array.isArray(v.citations)) return false;
  return v.citations.every(
    (c): c is ChatCitation => !!c && typeof c === "object" && typeof (c as Record<string, unknown>).quote === "string",
  );
}

/** Mode Explication — chat qui répond aux questions de l'étudiant
 * uniquement à partir de la matière (texte/photo/PDF) distillée dans la
 * session en cours du panneau IA. Même pipeline que /api/distill (mêmes
 * helpers, même vérification de taille) : seul le prompt et la forme de la
 * réponse changent. N'incrémente jamais generations_used et n'applique
 * aucune limite — une conversation illimitée une fois la distillation
 * initiale effectuée, comme convenu. Historique géré entièrement côté
 * client (aucune persistance serveur) : chaque appel reçoit l'historique
 * complet et le renvoie augmenté de la nouvelle question. */
export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return missingApiKeyResponse();
  }

  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté pour utiliser le Mode Explication." }, { status: 401 });
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const text = body.text?.trim();
  const { image, pdf } = body;
  const question = body.question?.trim();
  const history = Array.isArray(body.history) ? body.history : [];

  if (!question) {
    return NextResponse.json({ error: "Merci de poser une question." }, { status: 400 });
  }
  if (!text && !image && !pdf) {
    return NextResponse.json(
      { error: "Aucune note disponible pour répondre à cette question — distillez d'abord du contenu." },
      { status: 400 },
    );
  }

  const fileError = validateImageSize(image);
  if (fileError) {
    return NextResponse.json({ error: fileError }, { status: 400 });
  }

  let pdfFile: { data: string; mediaType: string } | undefined;
  try {
    if (pdf) {
      try {
        const { data } = await fetchPdfFromBlob(pdf.url);
        pdfFile = { data, mediaType: "application/pdf" };
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Impossible de récupérer le PDF téléversé." },
          { status: 400 },
        );
      }
    }

    // buildContentBlocks ne renvoie jamais une chaîne brute (toujours un
    // tableau de blocs construit localement) — le type large de sa
    // signature (partagée avec /api/distill) l'autorise en théorie, d'où
    // cette précision de type pour pouvoir l'étendre avec le bloc texte de
    // la question ci-dessous.
    const sourceContent = buildContentBlocks({ text, image, pdf: pdfFile }) as Anthropic.ContentBlockParam[];
    const client = new Anthropic({ apiKey });

    // Claude exige une conversation où les rôles alternent strictement en
    // commençant par "user". Les notes sources n'ont donc de sens que
    // rattachées au tout premier message "user" reconstruit ici : sur le
    // premier tour, c'est la question elle-même ; sur les suivants, c'est
    // la première question déjà posée (déjà présente dans `history`), les
    // tours suivants s'enchaînant ensuite normalement.
    const messages: Anthropic.MessageParam[] = [];
    if (history.length === 0) {
      messages.push({ role: "user", content: [...sourceContent, { type: "text", text: question }] });
    } else {
      const [firstTurn, ...restTurns] = history;
      messages.push({ role: "user", content: [...sourceContent, { type: "text", text: firstTurn.content }] });
      for (const turn of restTurns) {
        messages.push({ role: turn.role, content: turn.content });
      }
      messages.push({ role: "user", content: question });
    }

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages,
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Le modèle n'a pas pu répondre à cette question. Essayez de la reformuler." },
        { status: 422 },
      );
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Le modèle n'a renvoyé aucun contenu exploitable." }, { status: 502 });
    }

    const parsed = extractJson(textBlock.text);
    if (!isChatResponse(parsed)) {
      return NextResponse.json(
        { error: "La réponse du modèle ne correspond pas au format attendu. Réessayez." },
        { status: 502 },
      );
    }

    return NextResponse.json(parsed satisfies ChatResponseBody);
  } catch (error) {
    return anthropicErrorResponse(error);
  } finally {
    if (pdf) {
      await deletePdfBlob(pdf.url);
    }
  }
}
