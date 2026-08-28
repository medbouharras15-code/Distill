import { NextResponse } from "next/server";
import { getUserAndProfile } from "@/lib/auth";
import { PADDLE_PRICE_IDS } from "@/lib/paddle";
import { paddleFetch } from "@/lib/paddleServer";

/** Prépare l'ouverture de l'overlay de paiement Paddle (voir
 * openPaddleCheckout dans @/lib/paddle, appelée côté client juste après) :
 * renvoie l'id de l'utilisateur connecté et le Price ID du palier demandé.
 * Contrairement à Lemon Squeezy — dont le serveur crée directement le
 * checkout — Paddle.js ouvre le paiement entièrement côté client ; cette
 * route existe uniquement parce que le client n'a pas accès à l'id
 * utilisateur (nécessaire en custom_data pour que le webhook sache à quel
 * profil rattacher l'abonnement) sans le redemander à chaque fois au
 * serveur, seule source fiable de la session. */
export async function POST(request: Request) {
  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  let body: { tier?: string };
  try {
    body = (await request.json()) as { tier?: string };
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const tier = body.tier;
  if (tier !== "essentiel" && tier !== "etudiant" && tier !== "intensif") {
    return NextResponse.json({ error: "Palier invalide." }, { status: 400 });
  }

  const priceId = PADDLE_PRICE_IDS[tier];
  if (!priceId) {
    return NextResponse.json(
      { error: "Ce palier n'est pas encore configuré pour le paiement." },
      { status: 500 },
    );
  }

  // Vérifie côté serveur, avant même d'ouvrir l'overlay Paddle.js, que ce
  // Price ID est réellement utilisable (existe, actif, compte autorisé à
  // facturer...). L'overlay Paddle.js, lui, ne remonte pas toujours un
  // évènement exploitable pour ce genre d'échec de configuration — cette
  // requête donne le message d'erreur exact renvoyé par l'API Paddle,
  // affichable directement dans l'interface sans avoir besoin de la
  // console du navigateur.
  try {
    await paddleFetch("/transactions/preview", {
      method: "POST",
      body: { items: [{ price_id: priceId, quantity: 1 }] },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Paddle a rejeté ce palier : ${err instanceof Error ? err.message : "erreur inconnue"}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ userId: auth.user.id, priceId });
}
