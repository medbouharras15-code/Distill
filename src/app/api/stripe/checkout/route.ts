import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getUserAndProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** Crée une session Stripe Checkout pour l'abonnement mensuel et renvoie son
 * URL. Le client redirige ensuite le navigateur vers cette URL. */
export async function POST(request: Request) {
  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }
  const { user, profile } = auth;

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      { error: "L'abonnement n'est pas configuré sur le serveur." },
      { status: 500 },
    );
  }

  const origin = new URL(request.url).origin;

  try {
    const stripe = getStripe();

    // Réutilise le client Stripe existant s'il y en a déjà un, sinon en crée un.
    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      const admin = createAdminClient();
      await admin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
      client_reference_id: user.id,
    });

    if (!session.url) {
      throw new Error("Session Stripe créée sans URL.");
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Erreur lors de la création de la session Stripe Checkout :", error);
    return NextResponse.json(
      { error: "Impossible de démarrer le paiement pour le moment." },
      { status: 500 },
    );
  }
}
