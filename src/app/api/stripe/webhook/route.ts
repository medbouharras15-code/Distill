import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/** Reçoit les événements Stripe (paiement réussi, abonnement modifié ou
 * annulé, ...) et met à jour le profil Supabase correspondant. Doit lire le
 * corps brut de la requête pour vérifier la signature. */
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET n'est pas configurée sur le serveur.");
    return NextResponse.json({ error: "Webhook non configuré." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signature manquante." }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Signature de webhook Stripe invalide :", error);
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      // Paiement initial réussi : on relie l'abonnement Stripe au compte.
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (userId && subscriptionId) {
          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await admin
            .from("profiles")
            .update({
              stripe_customer_id: customerId ?? null,
              stripe_subscription_id: subscription.id,
              subscription_status: subscription.status,
            })
            .eq("id", userId);
        }
        break;
      }

      // Renouvellement, échec de paiement, changement de statut, annulation...
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;

        await admin
          .from("profiles")
          .update({
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status,
          })
          .eq("stripe_customer_id", customerId);
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error(`Erreur lors du traitement de l'événement Stripe ${event.type} :`, error);
    return NextResponse.json({ error: "Erreur de traitement." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
