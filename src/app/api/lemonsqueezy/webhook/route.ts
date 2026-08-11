import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface LemonSqueezyWebhookEvent {
  meta: {
    event_name: string;
    custom_data?: { user_id?: string };
  };
  data: {
    id: string;
    attributes: {
      status: string;
    };
  };
}

const SUBSCRIPTION_EVENTS = new Set([
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_resumed",
  "subscription_expired",
  "subscription_paused",
  "subscription_unpaused",
]);

/** Vérifie la signature HMAC-SHA256 envoyée par Lemon Squeezy dans l'en-tête
 * `X-Signature`, calculée sur le corps brut de la requête avec le secret
 * partagé. https://docs.lemonsqueezy.com/help/webhooks#signing-requests */
function isValidSignature(rawBody: string, signatureHeader: string | null, secret: string) {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const received = Buffer.from(signatureHeader, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** Reçoit les événements Lemon Squeezy (abonnement créé, mis à jour, annulé,
 * ...) et met à jour le profil Supabase correspondant. */
export async function POST(request: Request) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("LEMONSQUEEZY_WEBHOOK_SECRET n'est pas configurée sur le serveur.");
    return NextResponse.json({ error: "Webhook non configuré." }, { status: 500 });
  }

  const rawBody = await request.text();

  if (!isValidSignature(rawBody, request.headers.get("x-signature"), secret)) {
    console.error("Signature de webhook Lemon Squeezy invalide.");
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  let event: LemonSqueezyWebhookEvent;
  try {
    event = JSON.parse(rawBody) as LemonSqueezyWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    if (SUBSCRIPTION_EVENTS.has(event.meta.event_name)) {
      const subscriptionId = event.data.id;
      const status = event.data.attributes.status;
      const userId = event.meta.custom_data?.user_id;

      if (event.meta.event_name === "subscription_created" && userId) {
        // Premier événement pour cet abonnement : on l'associe à
        // l'utilisateur via le `custom_data` transmis lors du checkout.
        await admin
          .from("profiles")
          .update({ lemonsqueezy_subscription_id: subscriptionId, subscription_status: status })
          .eq("id", userId);
      } else {
        // Événements suivants : l'utilisateur est déjà associé à cet
        // abonnement, on le retrouve par son id.
        await admin
          .from("profiles")
          .update({ subscription_status: status })
          .eq("lemonsqueezy_subscription_id", subscriptionId);
      }
    }
  } catch (error) {
    console.error(`Erreur lors du traitement de l'événement Lemon Squeezy ${event.meta.event_name} :`, error);
    return NextResponse.json({ error: "Erreur de traitement." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
