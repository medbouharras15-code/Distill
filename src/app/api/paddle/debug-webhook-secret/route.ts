import { NextResponse } from "next/server";

/** TEMPORAIRE — même principe que la route de debug utilisée pour
 * PADDLE_API_KEY (déjà supprimée, avait révélé une clé tronquée à 33
 * caractères au lieu de 69) : inspecte PADDLE_WEBHOOK_SECRET sans jamais
 * exposer sa valeur complète, pour diagnostiquer les 400 "Signature
 * invalide" reçus par Paddle sur /api/paddle/webhook. À SUPPRIMER une fois
 * le diagnostic terminé. */
export async function GET() {
  const raw = process.env.PADDLE_WEBHOOK_SECRET ?? "";
  const trimmed = raw.trim();

  return NextResponse.json({
    isSet: raw.length > 0,
    rawLength: raw.length,
    trimmedLength: trimmed.length,
    hasLeadingWhitespace: raw.length > 0 && raw[0] !== trimmed[0],
    hasTrailingWhitespace: raw.length > 0 && raw[raw.length - 1] !== trimmed[trimmed.length - 1],
    containsNewline: raw.includes("\n") || raw.includes("\r"),
    containsTab: raw.includes("\t"),
    preview:
      trimmed.length > 12 ? `${trimmed.slice(0, 11)}…${trimmed.slice(-4)}` : "(trop courte pour un aperçu sûr)",
  });
}
