import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getUserAndProfile } from "@/lib/auth";
import { FREE_GENERATIONS_LIMIT, isSubscribed } from "@/lib/billing";
import {
  MODEL,
  anthropicErrorResponse,
  buildContentBlocks,
  callClaudeRaw,
  deletePdfBlob,
  extractJson,
  fetchPdfFromBlob,
  missingApiKeyResponse,
  validateImageSize,
} from "@/lib/distillServer";
import { COMPARISON_MODEL, IS_MODEL_COMPARISON_ENABLED, describeComparisonError } from "@/lib/modelComparison";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DistillRequestBody, DistillResult } from "@/lib/types";

// Le prompt exact demandé pour transformer les notes en résumé + flashcards.
// Le QCM est généré séparément par /api/distill/quiz (appel indépendant,
// lancé une fois ce résumé affiché) : cette route n'en a plus la charge, ce
// qui garde le premier affichage rapide comme avant l'introduction du QCM.
const SYSTEM_PROMPT = `Tu es un expert pédagogique. Génère un résumé structuré (titre, sections, points clés en gras) et 8 à 10 flashcards (question/réponse) à partir de ce contenu. Réponds uniquement en JSON : {"summary": "...", "flashcards": [{"question": "...", "answer": "..."}]}`;

// Depuis le passage des PDF à Vercel Blob, cette route peut recevoir des
// documents nettement plus lourds (jusqu'à 15 Mo) qu'auparavant — Claude met
// alors plus de temps à les analyser. 60s suffisait tant que les PDF étaient
// plafonnés à ~3,1 Mo, mais provoquait un 504 sur de plus gros documents.
// Alignée sur la même marge que /api/distill/quiz.
export const maxDuration = 300;

function isDistillResult(value: unknown): value is DistillResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.summary !== "string") return false;
  if (!Array.isArray(v.flashcards)) return false;
  return v.flashcards.every((card) => {
    if (!card || typeof card !== "object") return false;
    const c = card as Record<string, unknown>;
    return typeof c.question === "string" && typeof c.answer === "string";
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return missingApiKeyResponse();
  }

  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json(
      { error: "Vous devez être connecté pour distiller vos notes." },
      { status: 401 },
    );
  }
  const { user, profile } = auth;
  const subscribed = isSubscribed(profile);

  if (!subscribed && profile.generations_used >= FREE_GENERATIONS_LIMIT) {
    return NextResponse.json(
      {
        error: `Vous avez utilisé vos ${FREE_GENERATIONS_LIMIT} générations gratuites. Abonnez-vous pour continuer sans limite.`,
        limitReached: true,
      },
      { status: 403 },
    );
  }

  let body: DistillRequestBody;
  try {
    body = (await request.json()) as DistillRequestBody;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const text = body.text?.trim();
  const { image, pdf } = body;

  if (!text && !image && !pdf) {
    return NextResponse.json(
      {
        error:
          "Merci de coller du texte, ou d'ajouter une image ou un PDF avant de distiller vos notes.",
      },
      { status: 400 },
    );
  }

  const fileError = validateImageSize(image);
  if (fileError) {
    return NextResponse.json({ error: fileError }, { status: 400 });
  }

  // Le PDF n'arrive plus que sous forme de référence Vercel Blob (voir
  // @/app/api/upload/pdf) : on le télécharge et le reconvertit en base64
  // pour que buildContentBlocks reste inchangée, puis on supprime la copie
  // temporaire sur Blob une fois l'appel à Claude terminé — succès ou échec.
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

    const content = buildContentBlocks({ text, image, pdf: pdfFile });
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        {
          error:
            "Le modèle n'a pas pu traiter ce contenu. Essayez avec un autre texte ou fichier.",
        },
        { status: 422 },
      );
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "Le modèle n'a renvoyé aucun contenu exploitable." },
        { status: 502 },
      );
    }

    const parsed = extractJson(textBlock.text);
    if (!isDistillResult(parsed)) {
      return NextResponse.json(
        {
          error:
            "La réponse du modèle ne correspond pas au format attendu. Réessayez.",
        },
        { status: 502 },
      );
    }

    // Ne compte que pour les comptes non abonnés — un abonné actif n'a pas
    // de limite. L'écriture passe par le client "service role" car les
    // utilisateurs n'ont pas le droit de modifier leur propre compteur.
    // Cet unique incrément couvre tout le résultat (résumé + flashcards +,
    // le cas échéant, le QCM généré séparément juste après par le client) :
    // /api/distill/quiz n'incrémente jamais ce compteur lui-même.
    if (!subscribed) {
      const admin = createAdminClient();
      await admin
        .from("profiles")
        .update({ generations_used: profile.generations_used + 1 })
        .eq("id", user.id);
    }

    const result: DistillResult = { ...parsed };

    // Mode comparaison (Preview/dev uniquement, voir @/lib/modelComparison) :
    // un second appel, best-effort, sur le même contenu et le même prompt.
    // Un échec ici ne fait jamais échouer la requête — le résultat principal
    // est déjà généré avec succès à ce stade.
    if (IS_MODEL_COMPARISON_ENABLED && body.compareWithHaiku) {
      try {
        const compareText = await callClaudeRaw(client, {
          model: COMPARISON_MODEL,
          maxTokens: 4096,
          system: SYSTEM_PROMPT,
          content,
        });
        const compareParsed = extractJson(compareText);
        if (isDistillResult(compareParsed)) {
          result.comparison = { model: COMPARISON_MODEL, summary: compareParsed.summary, flashcards: compareParsed.flashcards };
        } else {
          result.comparisonError = "La réponse du modèle de comparaison ne correspond pas au format attendu.";
        }
      } catch (error) {
        result.comparisonError = describeComparisonError(error);
      }
    }

    return NextResponse.json(result satisfies DistillResult);
  } catch (error) {
    return anthropicErrorResponse(error);
  } finally {
    if (pdf) {
      await deletePdfBlob(pdf.url);
    }
  }
}
