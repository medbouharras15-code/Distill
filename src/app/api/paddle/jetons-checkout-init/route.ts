import { NextResponse } from "next/server";
import { getUserAndProfile } from "@/lib/auth";
import { getTier } from "@/lib/billing";
import { JETONS_PACK_MAX_QUANTITY, JETONS_PACK_MIN_QUANTITY, JETONS_PACK_PRICE_ID } from "@/lib/paddle";
import { paddleFetch } from "@/lib/paddleServer";

/** Prépare l'ouverture de l'overlay de paiement Paddle pour un achat de
 * jetons à la carte — équivalent de /api/paddle/checkout-init, mais réservé
 * aux abonnés Essentiel/Étudiant (voir plan validé : Intensif a déjà un
 * plafond confortable, un compte gratuit n'a pas de plafond mensuel à
 * dépasser au sens où ce mécanisme l'entend). */
export async function POST(request: Request) {
  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const tier = getTier(auth.profile);
  if (tier !== "essentiel" && tier !== "etudiant") {
    return NextResponse.json(
      { error: "L'achat de jetons supplémentaires est réservé aux paliers Essentiel et Étudiant." },
      { status: 403 },
    );
  }

  let body: { quantity?: number };
  try {
    body = (await request.json()) as { quantity?: number };
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const quantity = body.quantity;
  if (
    typeof quantity !== "number" ||
    !Number.isInteger(quantity) ||
    quantity < JETONS_PACK_MIN_QUANTITY ||
    quantity > JETONS_PACK_MAX_QUANTITY
  ) {
    return NextResponse.json(
      { error: `Quantité invalide (${JETONS_PACK_MIN_QUANTITY} à ${JETONS_PACK_MAX_QUANTITY} lots).` },
      { status: 400 },
    );
  }

  if (!JETONS_PACK_PRICE_ID) {
    return NextResponse.json({ error: "L'achat de jetons n'est pas encore configuré pour le paiement." }, { status: 500 });
  }

  // Même prévalidation que les autres checkout-init (voir leur historique) :
  // confirme que ce Price ID existe, est actif et appartient au bon
  // compte/environnement avant d'ouvrir l'overlay Paddle.js.
  try {
    const { data: price } = await paddleFetch<{ data: { status?: string } }>(`/prices/${JETONS_PACK_PRICE_ID}`);
    if (price.status !== "active") {
      return NextResponse.json(
        {
          error: `Paddle a rejeté ce produit : le prix ${JETONS_PACK_PRICE_ID} a le statut "${price.status}" (attendu : "active").`,
        },
        { status: 502 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Paddle a rejeté ce produit : ${err instanceof Error ? err.message : "erreur inconnue"}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ userId: auth.user.id, priceId: JETONS_PACK_PRICE_ID, quantity });
}
