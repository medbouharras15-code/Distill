import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getUserAndProfile } from "@/lib/auth";
import { FREE_GENERATIONS_LIMIT, isSubscribed } from "@/lib/billing";
import {
  MODEL,
  anthropicErrorResponse,
  buildContentBlocks,
  extractJson,
  missingApiKeyResponse,
  validateFileSizes,
} from "@/lib/distillServer";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DistillRequestBody, DistillResult } from "@/lib/types";

// Le prompt exact demandé pour transformer les notes en résumé + flashcards.
// Le QCM est généré séparément par /api/distill/quiz (appel indépendant,
// lancé une fois ce résumé affiché) : cette route n'en a plus la charge, ce
// qui garde le premier affichage rapide comme avant l'introduction du QCM.
const SYSTEM_PROMPT = `Tu es un expert pédagogique. Génère un résumé structuré (titre, sections, points clés en gras) et 8 à 10 flashcards (question/réponse) à partir de ce contenu. Réponds uniquement en JSON : {"summary": "...", "flashcards": [{"question": "...", "answer": "..."}]}`;

// Laisse plus de temps à Vercel pour l'analyse d'image (le délai par défaut
// peut être trop court, ce qui provoquait une page d'erreur non-JSON côté
// client sur les envois avec photo).
export const maxDuration = 60;

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

  const fileError = validateFileSizes(image, pdf);
  if (fileError) {
    return NextResponse.json({ error: fileError }, { status: 400 });
  }

  const content = buildContentBlocks({ text, image, pdf });
  const client = new Anthropic({ apiKey });

  try {
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

    return NextResponse.json(parsed satisfies DistillResult);
  } catch (error) {
    return anthropicErrorResponse(error);
  }
}
