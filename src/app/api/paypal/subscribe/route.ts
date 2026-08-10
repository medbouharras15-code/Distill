import { NextResponse } from "next/server";
import { paypalFetch } from "@/lib/paypal";
import { getUserAndProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface PayPalSubscription {
  id: string;
  status: string;
  links: { rel: string; href: string }[];
}

/** Crée un abonnement PayPal et renvoie l'URL de la page hébergée par
 * PayPal où l'utilisateur approuve le paiement (le formulaire de carte est
 * entièrement affiché par PayPal, jamais par notre serveur). */
export async function POST(request: Request) {
  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }
  const { user } = auth;

  const planId = process.env.PAYPAL_PLAN_ID;
  if (!planId) {
    return NextResponse.json(
      { error: "L'abonnement n'est pas configuré sur le serveur." },
      { status: 500 },
    );
  }

  const origin = new URL(request.url).origin;

  try {
    const subscription = await paypalFetch<PayPalSubscription>("/v1/billing/subscriptions", {
      method: "POST",
      body: {
        plan_id: planId,
        custom_id: user.id,
        subscriber: user.email ? { email_address: user.email } : undefined,
        application_context: {
          brand_name: "Distill",
          locale: "fr-FR",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${origin}/?checkout=success`,
          cancel_url: `${origin}/?checkout=cancelled`,
        },
      },
    });

    const approveUrl = subscription.links.find((l) => l.rel === "approve")?.href;
    if (!approveUrl) {
      throw new Error("PayPal n'a renvoyé aucun lien d'approbation.");
    }

    // On enregistre l'abonnement dès sa création (statut encore en attente
    // d'approbation) ; le webhook le fera passer à "ACTIVE" une fois payé.
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({
        paypal_subscription_id: subscription.id,
        subscription_status: subscription.status,
      })
      .eq("id", user.id);

    return NextResponse.json({ url: approveUrl });
  } catch (error) {
    console.error("Erreur lors de la création de l'abonnement PayPal :", error);
    return NextResponse.json(
      { error: "Impossible de démarrer le paiement pour le moment." },
      { status: 500 },
    );
  }
}
