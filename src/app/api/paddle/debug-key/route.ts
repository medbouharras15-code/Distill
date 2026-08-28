import { NextResponse } from "next/server";

/** TEMPORAIRE — inspecte PADDLE_API_KEY telle que lue par le serveur, sans
 * jamais exposer sa valeur complète, pour diagnostiquer un
 * "authentication_malformed" persistant malgré le .trim() déjà appliqué
 * dans @/lib/paddleServer. `preview` ne montre que le préfixe et les 4
 * derniers caractères — assez pour repérer une troncature ou une confusion
 * de champ (ex. token client collé à la place de la clé API), pas assez
 * pour être exploitable. À SUPPRIMER une fois le diagnostic terminé. */
export async function GET() {
  const raw = process.env.PADDLE_API_KEY ?? "";
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
      trimmed.length > 12 ? `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}` : "(trop courte pour un aperçu sûr)",
    // Codes de caractères (Unicode) aux deux extrémités — repère un
    // caractère invisible non couvert par .trim() (ex. espace insécable
    // U+00A0, espace de largeur nulle U+200B...).
    firstCharCodes: [...trimmed.slice(0, 5)].map((c) => c.charCodeAt(0)),
    lastCharCodes: [...trimmed.slice(-5)].map((c) => c.charCodeAt(0)),
  });
}
