import Anthropic from "@anthropic-ai/sdk";
import { del, get } from "@vercel/blob";
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

/** Valide la taille de l'image jointe (toujours transmise inline, en
 * base64) ; renvoie un message d'erreur si elle dépasse MAX_IMAGE_FILE_BYTES,
 * sinon `null`. Le PDF, lui, est vérifié à part par fetchPdfFromBlob une
 * fois téléchargé (voir plus bas) : sa taille n'est plus connue à ce stade
 * puisqu'il n'arrive plus que sous forme de référence Vercel Blob. */
export function validateImageSize(image?: DistillRequestFile): string | null {
  if (image && base64ByteLength(image.data) > MAX_IMAGE_FILE_BYTES) {
    return `L'image est trop volumineuse (${(MAX_IMAGE_FILE_BYTES / (1024 * 1024)).toFixed(1)} Mo maximum une fois traitée).`;
  }
  return null;
}

/** Télécharge le PDF téléversé sur Vercel Blob par le navigateur (voir
 * @/app/api/upload/pdf) et le convertit en base64 pour buildContentBlocks —
 * qui n'a pas besoin de savoir que le fichier n'est plus arrivé inline dans
 * la requête. Revalide aussi la taille réelle (défense en profondeur : la
 * limite est déjà appliquée à l'upload via `maximumSizeInBytes`, mais on ne
 * fait pas une confiance aveugle à ce qui a atterri sur le stockage). */
export async function fetchPdfFromBlob(url: string): Promise<{ data: string; sizeBytes: number }> {
  const result = await get(url, { access: "private" });
  if (!result) {
    throw new Error("Le PDF téléversé est introuvable ou a expiré. Réessayez.");
  }

  const buffer = await new Response(result.stream).arrayBuffer();
  if (buffer.byteLength > MAX_PDF_FILE_BYTES) {
    throw new Error(`Le PDF est trop volumineux (${(MAX_PDF_FILE_BYTES / (1024 * 1024)).toFixed(0)} Mo maximum).`);
  }

  return { data: Buffer.from(buffer).toString("base64"), sizeBytes: buffer.byteLength };
}

/** Supprime le PDF temporaire sur Vercel Blob une fois qu'on n'en a plus
 * besoin (fin de traitement, succès ou échec) — chaque appel à /api/distill
 * ou /api/distill/quiz téléverse sa propre copie et la supprime lui-même
 * juste après usage, plutôt que de garder un fichier partagé entre appels
 * dont la durée de vie serait plus difficile à raisonner. Ne fait jamais
 * échouer la requête : l'utilisateur a déjà sa réponse, un fichier orphelin
 * en cas d'échec de suppression n'est pas bloquant. */
export async function deletePdfBlob(url: string): Promise<void> {
  try {
    await del(url);
  } catch (error) {
    console.error("Impossible de supprimer le PDF temporaire sur Vercel Blob :", error);
  }
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

/** Variante brute d'un appel à Claude, pour le mode comparaison de modèles
 * (voir @/lib/modelComparison) — même contenu/prompt que l'appel principal,
 * modèle et budget de tokens arbitraires, aucune validation de forme :
 * chaque appelant applique son propre extractJson + sa propre validation,
 * identiques à celles de l'appel principal. Lève systématiquement une
 * erreur explicite plutôt que de renvoyer une réponse HTTP — c'est
 * l'appelant qui décide comment traiter un échec de la comparaison (jamais
 * en faisant échouer la génération principale, déjà réussie). */
export async function callClaudeRaw(
  client: Anthropic,
  {
    model,
    maxTokens,
    system,
    content,
  }: { model: string; maxTokens: number; system: string; content: Anthropic.MessageParam["content"] },
): Promise<string> {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Le modèle de comparaison a refusé de traiter ce contenu.");
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Le modèle de comparaison n'a renvoyé aucun contenu exploitable.");
  }

  return textBlock.text;
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
