import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { tierForPriceId } from "@/lib/paddle";
import { createAdminClient } from "@/lib/supabase/admin";

interface PaddleWebhookEvent {
  event_id: string;
  event_type: string;
  data: {
    id: string;
    status: string;
    customer_id: string;
    items?: { price?: { id?: string } }[];
    custom_data?: { user_id?: string } | null;
  };
}

const SUBSCRIPTION_EVENTS = new Set(["subscription.created", "subscription.updated", "subscription.canceled"]);

/** Tolérance sur l'âge du webhook (secondes) — Paddle recommande 5-30s pour
 * se protéger d'un rejeu, mais une marge plus large absorbe la latence
 * réseau réelle sans rejeter à tort des webhooks légitimes (même principe
 * que la vérification de signature Lemon Squeezy, à qui on ajoute ici cette
 * protection supplémentaire propre à Paddle). */
const MAX_SIGNATURE_AGE_SECONDS = 300;

/** Vérifie la signature `Paddle-Signature: ts=...;h1=...` — HMAC-SHA256 de
 * "<ts>:<corps brut>" avec le secret du webhook, comparée en temps constant.
 * https://developer.paddle.com/webhooks/about/signature-verification */
function isValidPaddleSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(";").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  );
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(ageSeconds) || ageSeconds > MAX_SIGNATURE_AGE_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex");
  let expectedBuf: Buffer;
  let receivedBuf: Buffer;
  try {
    expectedBuf = Buffer.from(expected, "hex");
    receivedBuf = Buffer.from(h1, "hex");
  } catch {
    return false;
  }
  return expectedBuf.length === receivedBuf.length && timingSafeEqual(expectedBuf, receivedBuf);
}

/** Reçoit les événements Paddle (abonnement créé, mis à jour, annulé) et met
 * à jour le profil Supabase correspondant — équivalent Paddle de
 * /api/lemonsqueezy/webhook, qui reste actif en parallèle pour l'unique
 * abonné existant avant cette migration (voir @/lib/paddle, en-tête). */
export async function POST(request: Request) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("PADDLE_WEBHOOK_SECRET n'est pas configurée sur le serveur.");
    return NextResponse.json({ error: "Webhook non configuré." }, { status: 500 });
  }

  const rawBody = await request.text();

  if (!isValidPaddleSignature(rawBody, request.headers.get("paddle-signature"), secret)) {
    console.error("Signature de webhook Paddle invalide.");
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  let event: PaddleWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaddleWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  if (!SUBSCRIPTION_EVENTS.has(event.event_type)) {
    return NextResponse.json({ received: true });
  }

  const admin = createAdminClient();
  const subscriptionId = event.data.id;
  const status = event.data.status;
  // Le prix réellement facturé (voir data.items) est une source plus fiable
  // du palier que custom_data.tier, transmis par le client au moment du
  // checkout — celui-ci reflète ce que Paddle a effectivement vendu.
  const priceId = event.data.items?.[0]?.price?.id;
  const tier = priceId ? tierForPriceId(priceId) : null;
  if (!tier) {
    // Ne bloque jamais l'abonné (voir plus bas, subscription_tier reste
    // simplement `null`, traité comme "intensif" par getTier dans
    // @/lib/billing) — mais un Price ID Paddle réellement facturé qui ne
    // correspond à aucun de nos 3 paliers connus indique presque toujours
    // un PADDLE_PRICE_ID_* mal configuré, à corriger.
    console.error("Price ID Paddle non reconnu — vérifier NEXT_PUBLIC_PADDLE_PRICE_ID_* :", priceId);
  }

  try {
    if (event.event_type === "subscription.created") {
      const userId = event.data.custom_data?.user_id;
      if (!userId) {
        console.error("subscription.created Paddle sans custom_data.user_id — impossible de l'associer à un profil.");
        return NextResponse.json({ received: true });
      }

      await admin
        .from("profiles")
        .update({
          paddle_subscription_id: subscriptionId,
          paddle_customer_id: event.data.customer_id,
          subscription_status: status,
          subscription_tier: tier,
        })
        .eq("id", userId);
    } else {
      // subscription.updated / subscription.canceled : l'utilisateur est
      // déjà associé à cet abonnement, on le retrouve par son id Paddle.
      // subscription_tier n'est mis à jour que si ce webhook précis permet
      // de le déterminer avec confiance (changement de palier) — jamais
      // écrasé à `null` faute de mieux, ce qui effacerait à tort un palier
      // déjà correctement enregistré (l'annulation, par exemple, n'a pas
      // besoin de toucher ce champ : isSubscribed() redevient déjà faux dès
      // que subscription_status change, sans égard à subscription_tier).
      await admin
        .from("profiles")
        .update({ subscription_status: status, ...(tier ? { subscription_tier: tier } : {}) })
        .eq("paddle_subscription_id", subscriptionId);
    }
  } catch (error) {
    console.error(`Erreur lors du traitement de l'événement Paddle ${event.event_type} :`, error);
    return NextResponse.json({ error: "Erreur de traitement." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
