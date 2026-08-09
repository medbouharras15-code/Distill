import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getUserAndProfile } from "@/lib/auth";
import { FREE_GENERATIONS_LIMIT, isSubscribed } from "@/lib/billing";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DistillRequestBody, DistillResult } from "@/lib/types";

// Le prompt exact demandé pour transformer les notes en résumé + flashcards.
const SYSTEM_PROMPT = `Tu es un expert pédagogique. Génère un résumé structuré (titre, sections, points clés en gras) et 8 à 10 flashcards (question/réponse) à partir de ce contenu. Réponds uniquement en JSON : {"summary": "...", "flashcards": [{"question": "...", "answer": "..."}]}`;

const MODEL = "claude-sonnet-4-6";
// Doit rester cohérent avec les limites côté client (src/components/DistillApp.tsx) :
// les images sont compressées avant envoi, les PDF sont plafonnés à 3 Mo.
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 Mo par fichier une fois décodé

// Laisse plus de temps à Vercel pour l'analyse d'image / génération des
// flashcards (le délai par défaut peut être trop court, ce qui provoquait
// une page d'erreur non-JSON côté client sur les envois avec photo).
export const maxDuration = 60;

function base64ByteLength(base64: string): number {
  const cleaned = base64.replace(/=+$/, "");
  return Math.floor((cleaned.length * 3) / 4);
}

/** Extrait un objet JSON depuis la réponse texte du modèle, même si elle est
 * entourée de balises markdown ``` ou de texte superflu. */
function extractJson(text: string): unknown {
  let candidate = text.trim();

  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    candidate = fenced[1].trim();
  }

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("Réponse du modèle non conforme au format JSON attendu.");
  }
}

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
    return NextResponse.json(
      {
        error:
          "La clé API Anthropic n'est pas configurée sur le serveur. Ajoutez ANTHROPIC_API_KEY dans le fichier .env.local puis redémarrez le serveur.",
      },
      { status: 500 },
    );
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

  for (const file of [image, pdf]) {
    if (file && base64ByteLength(file.data) > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Le fichier est trop volumineux (4 Mo maximum une fois traité)." },
        { status: 400 },
      );
    }
  }

  const content: Anthropic.MessageParam["content"] = [];

  if (image) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: image.mediaType as
          | "image/jpeg"
          | "image/png"
          | "image/gif"
          | "image/webp",
        data: image.data,
      },
    });
  }

  if (pdf) {
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: pdf.data,
      },
    });
  }

  if (text) {
    content.push({ type: "text", text });
  }

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
    if (!subscribed) {
      const admin = createAdminClient();
      await admin
        .from("profiles")
        .update({ generations_used: profile.generations_used + 1 })
        .eq("id", user.id);
    }

    return NextResponse.json(parsed satisfies DistillResult);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Clé API Anthropic invalide." },
        { status: 401 },
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        {
          error:
            "Trop de requêtes envoyées à l'API Claude. Réessayez dans un instant.",
        },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Erreur de l'API Claude : ${error.message}` },
        { status: error.status ?? 500 },
      );
    }

    console.error("Erreur inattendue lors de l'appel à Claude :", error);
    return NextResponse.json(
      { error: "Une erreur inattendue est survenue." },
      { status: 500 },
    );
  }
}
