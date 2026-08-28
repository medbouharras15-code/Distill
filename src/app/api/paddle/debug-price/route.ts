import { NextResponse } from "next/server";
import { paddleFetch } from "@/lib/paddleServer";

/** TEMPORAIRE — route de debug pour diagnostiquer un "not_found" sur les
 * Price ID Business Team malgré un PADDLE_API_KEY confirmé fonctionnel sur
 * les 3 Price ID individuels. Appelle GET /prices/{id} avec PADDLE_API_KEY
 * et renvoie la réponse brute de Paddle, pour vérifier depuis un navigateur
 * (URL directe, sans Postman) si l'API key et le Price ID appartiennent au
 * même compte Paddle. Volontairement sans authentification (uniquement des
 * métadonnées Paddle non sensibles renvoyées, aucune donnée utilisateur) —
 * la vérification de session posait plus de friction que le diagnostic lui-
 * même sur iPad (nouvel onglet = nouvelle session Safari). À SUPPRIMER une
 * fois le diagnostic terminé — ne doit pas rester en production. */
export async function GET(request: Request) {
  const priceId = new URL(request.url).searchParams.get("id");
  if (!priceId) {
    return NextResponse.json({ error: "Paramètre ?id=pri_... manquant." }, { status: 400 });
  }

  try {
    const result = await paddleFetch(`/prices/${priceId}`);
    return NextResponse.json({ ok: true, priceId, result });
  } catch (err) {
    return NextResponse.json({ ok: false, priceId, error: err instanceof Error ? err.message : "erreur inconnue" });
  }
}
