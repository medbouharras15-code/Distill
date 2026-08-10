import { NextResponse } from "next/server";
import { paypalFetch } from "@/lib/paypal";
import { createAdminClient } from "@/lib/supabase/admin";

interface PayPalWebhookEvent {
  event_type: string;
  resource: {
    id?: string;
    custom_id?: string;
    status?: string;
    billing_agreement_id?: string; // présent sur certains événements de paiement
  };
}

/** Reçoit les événements PayPal (abonnement activé, suspendu, annulé, ...)
 * et met à jour le profil Supabase correspondant. Chaque webhook est vérifié
 * auprès de PayPal avant d'être traité — voir
 * https://developer.paypal.com/api/rest/webhooks/rest/ */
export async function POST(request: Request) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.error("PAYPAL_WEBHOOK_ID n'est pas configurée sur le serveur.");
    return NextResponse.json({ error: "Webhook non configuré." }, { status: 500 });
  }

  const rawBody = await request.text();
  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PayPalWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  try {
    const verification = await paypalFetch<{ verification_status: string }>(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: {
          auth_algo: request.headers.get("paypal-auth-algo"),
          cert_url: request.headers.get("paypal-cert-url"),
          transmission_id: request.headers.get("paypal-transmission-id"),
          transmission_sig: request.headers.get("paypal-transmission-sig"),
          transmission_time: request.headers.get("paypal-transmission-time"),
          webhook_id: webhookId,
          webhook_event: event,
        },
      },
    );

    if (verification.verification_status !== "SUCCESS") {
      console.error("Signature de webhook PayPal invalide.");
      return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
    }
  } catch (error) {
    console.error("Échec de la vérification du webhook PayPal :", error);
    return NextResponse.json({ error: "Vérification impossible." }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.event_type) {
      case "BILLING.SUBSCRIPTION.ACTIVATED":
      case "BILLING.SUBSCRIPTION.UPDATED":
      case "BILLING.SUBSCRIPTION.SUSPENDED":
      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.EXPIRED": {
        const subscriptionId = event.resource.id;
        const status = event.resource.status;
        if (!subscriptionId || !status) break;

        // On identifie l'utilisateur par l'ID d'abonnement (fiable) plutôt
        // que par custom_id, qui n'est pas toujours renvoyé sur ces
        // événements de cycle de vie.
        await admin
          .from("profiles")
          .update({ subscription_status: status })
          .eq("paypal_subscription_id", subscriptionId);
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error(`Erreur lors du traitement de l'événement PayPal ${event.event_type} :`, error);
    return NextResponse.json({ error: "Erreur de traitement." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
