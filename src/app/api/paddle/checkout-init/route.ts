import { NextResponse } from "next/server";
import { getUserAndProfile } from "@/lib/auth";
import { PADDLE_PRICE_IDS } from "@/lib/paddle";

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

  return NextResponse.json({ userId: auth.user.id, priceId });
}
