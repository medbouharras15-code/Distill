import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { MAX_IMAGE_FILE_BYTES, MAX_PDF_FILE_BYTES } from "@/lib/fileSizeLimits";
import type { DistillRequestFile, QuizQuestion } from "@/lib/types";

export const MODEL = "claude-sonnet-4-6";

export function base64ByteLength(base64: string): number {
  const cleaned = base64.replace(/=+$/, "");
  return Math.floor((cleaned.length * 3) / 4);
}

/** Extrait un objet JSON depuis la réponse texte du modèle, même si elle est
 * entourée de balises markdown ``` ou de texte superflu. */
export function extractJson(text: string): unknown {
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

export function isQuizQuestion(value: unknown): value is QuizQuestion {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.question !== "string") return false;

  if (!Array.isArray(v.choices) || v.choices.length < 2) return false;
  const choiceIds = new Set<string>();
  for (const choice of v.choices) {
    if (!choice || typeof choice !== "object") return false;
    const c = choice as Record<string, unknown>;
    if (typeof c.id !== "string" || typeof c.text !== "string") return false;
    choiceIds.add(c.id);
  }

  if (!Array.isArray(v.correctChoiceIds) || v.correctChoiceIds.length === 0) return false;
  if (!v.correctChoiceIds.every((id) => typeof id === "string" && choiceIds.has(id))) return false;

  if (v.explanation !== undefined && typeof v.explanation !== "string") return false;

  return true;
}

/** Valide la taille de l'image et du PDF joints (limites distinctes, voir
 * MAX_IMAGE_FILE_BYTES / MAX_PDF_FILE_BYTES) ; renvoie un message d'erreur
 * précis dès qu'un fichier dépasse sa limite, sinon `null`. Partagé entre
 * /api/distill et /api/distill/quiz, qui reçoivent tous les deux les mêmes
 * pièces jointes. */
export function validateFileSizes(image?: DistillRequestFile, pdf?: DistillRequestFile): string | null {
  if (image && base64ByteLength(image.data) > MAX_IMAGE_FILE_BYTES) {
    return `L'image est trop volumineuse (${(MAX_IMAGE_FILE_BYTES / (1024 * 1024)).toFixed(1)} Mo maximum une fois traitée).`;
  }
  if (pdf && base64ByteLength(pdf.data) > MAX_PDF_FILE_BYTES) {
    return `Le PDF est trop volumineux (${(MAX_PDF_FILE_BYTES / (1024 * 1024)).toFixed(1)} Mo maximum une fois traité).`;
  }
  return null;
}

/** Construit le contenu multimodal (image/PDF/texte) envoyé à Claude — même
 * matière source pour le résumé/flashcards et pour le QCM. */
export function buildContentBlocks({
  text,
  image,
  pdf,
}: {
  text?: string;
  image?: DistillRequestFile;
  pdf?: DistillRequestFile;
}): Anthropic.MessageParam["content"] {
  const content: Anthropic.MessageParam["content"] = [];

  if (image) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: image.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
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

  return content;
}

/** Traduit une erreur de l'appel à Claude en réponse HTTP — même
 * comportement pour /api/distill et /api/distill/quiz. */
export function anthropicErrorResponse(error: unknown): NextResponse {
  if (error instanceof Anthropic.AuthenticationError) {
    return NextResponse.json({ error: "Clé API Anthropic invalide." }, { status: 401 });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return NextResponse.json(
      { error: "Trop de requêtes envoyées à l'API Claude. Réessayez dans un instant." },
      { status: 429 },
    );
  }
  if (error instanceof Anthropic.APIError) {
    return NextResponse.json({ error: `Erreur de l'API Claude : ${error.message}` }, { status: error.status ?? 500 });
  }

  console.error("Erreur inattendue lors de l'appel à Claude :", error);
  return NextResponse.json({ error: "Une erreur inattendue est survenue." }, { status: 500 });
}

export function missingApiKeyResponse(): NextResponse {
  return NextResponse.json(
    {
      error:
        "La clé API Anthropic n'est pas configurée sur le serveur. Ajoutez ANTHROPIC_API_KEY dans le fichier .env.local puis redémarrez le serveur.",
    },
    { status: 500 },
  );
}
