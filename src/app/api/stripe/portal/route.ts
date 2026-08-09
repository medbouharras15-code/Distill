import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getUserAndProfile } from "@/lib/auth";

/** Crée une session du portail client Stripe (gérer / annuler l'abonnement,
 * factures) et renvoie son URL. */
export async function POST(request: Request) {
  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }
  const { profile } = auth;

  if (!profile.stripe_customer_id) {
    return NextResponse.json(
      { error: "Aucun abonnement à gérer pour le moment." },
      { status: 400 },
    );
  }

  const origin = new URL(request.url).origin;

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Erreur lors de la création de la session du portail Stripe :", error);
    return NextResponse.json(
      { error: "Impossible d'ouvrir la gestion de l'abonnement pour le moment." },
      { status: 500 },
    );
  }
}
