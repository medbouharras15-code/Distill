import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { buildFakeDistillResult, IS_SIMULATION_ENABLED } from "@/lib/aiSimulation";
import { logAiUsageEvent } from "@/lib/aiUsage";
import { getUserAndProfile } from "@/lib/auth";
import { FREE_GENERATIONS_LIMIT, isSubscribed } from "@/lib/billing";
import {
  SHARED_TASK_SYSTEM_PROMPT,
  anthropicErrorResponse,
  buildContentBlocks,
  callClaudeWithFallback,
  deletePdfBlob,
  extractJson,
  fetchPdfFromBlob,
  missingApiKeyResponse,
  validateImageSize,
  withCacheControl,
} from "@/lib/distillServer";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DistillRequestBody, DistillResult } from "@/lib/types";

// Instructions propres au résumé — placées dans le message utilisateur
// (après le contenu source mis en cache) plutôt que dans le system prompt,
// qui reste volontairement générique et partagé avec /api/distill/quiz :
// voir SHARED_TASK_SYSTEM_PROMPT dans distillServer.ts. Le QCM est généré
// séparément par /api/distill/quiz (appel indépendant, lancé une fois ce
// résumé affiché) : cette route n'en a plus la charge, ce qui garde le
// premier affichage rapide comme avant l'introduction du QCM.
const RESUME_INSTRUCTIONS = `Génère un résumé structuré (titre, sections, points clés en gras) et 8 à 10 flashcards (question/réponse) à partir de ce contenu. Format JSON attendu : {"summary": "...", "flashcards": [{"question": "...", "answer": "..."}]}`;

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
    let parsed: DistillResult;

    if (IS_SIMULATION_ENABLED) {
      // Mode simulation (Preview uniquement, voir aiSimulation.ts) :
      // aucun appel réel à Claude, ni téléchargement du PDF — on renvoie
      // directement un résultat factice pour tester l'interface sans coût.
      parsed = await buildFakeDistillResult();
    } else {
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

      // Le contenu source est mis en cache (voir withCacheControl) : le même
      // PDF/photo/texte est renvoyé quelques secondes plus tard, à l'identique,
      // par /api/distill/quiz pour générer le QCM — ce dernier peut alors le
      // relire depuis le cache Anthropic au lieu de le retraiter en entier.
      const sourceContent = buildContentBlocks({ text, image, pdf: pdfFile }) as Anthropic.ContentBlockParam[];
      const content = [...withCacheControl(sourceContent), { type: "text" as const, text: RESUME_INSTRUCTIONS }];
      const client = new Anthropic({ apiKey });

      const response = await callClaudeWithFallback(client, {
        maxTokens: 4096,
        system: SHARED_TASK_SYSTEM_PROMPT,
        content,
      });

      // Diagnostic temporaire (même log que /api/distill/chat) pour vérifier
      // que /api/distill/quiz relit bien ce contenu source depuis le cache
      // quelques secondes plus tard. À retirer une fois la vérification faite.
      console.log("[distill] usage Anthropic :", response.usage);

      // Suivi de consommation (Paramètres > IA Distill) — response.model
      // reflète le modèle qui a réellement répondu (Haiku ou Sonnet selon
      // repli). N'échoue jamais la requête si l'écriture échoue.
      await logAiUsageEvent({ userId: user.id, category: "generation", model: response.model, usage: response.usage });

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

      const candidate = extractJson(textBlock.text);
      if (!isDistillResult(candidate)) {
        return NextResponse.json(
          {
            error:
              "La réponse du modèle ne correspond pas au format attendu. Réessayez.",
          },
          { status: 502 },
        );
      }
      parsed = candidate;
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

    return NextResponse.json(parsed satisfies DistillResult);
  } catch (error) {
    return anthropicErrorResponse(error);
  } finally {
    if (pdf) {
      await deletePdfBlob(pdf.url);
    }
  }
}
