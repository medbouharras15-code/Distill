import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { isJetonsPriceId, JETONS_PER_PACK, teamTierForPriceId, tierForPriceId } from "@/lib/paddle";
import { createAdminClient } from "@/lib/supabase/admin";

interface PaddleWebhookEvent {
  event_id: string;
  event_type: string;
  data: {
    id: string;
    status: string;
    customer_id: string;
    items?: { price?: { id?: string }; quantity?: number }[];
    // `team_id` distingue un abonnement Business Team (par siège) d'un
    // abonnement individuel — voir openTeamPaddleCheckout dans @/lib/paddle.
    custom_data?: { user_id?: string; team_id?: string } | null;
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

/** Traite un achat de jetons à la carte (produit Paddle one-time — voir
 * openJetonsPurchase dans @/lib/paddle) : contrairement aux abonnements,
 * une transaction one-time ne crée aucune Subscription côté Paddle, donc
 * aucun `subscription.created` n'est jamais émis pour cet achat — c'est
 * `transaction.completed` qu'il faut écouter. Cet évènement peut aussi être
 * émis pour d'autres transactions (ex. le premier paiement d'un
 * abonnement) : on ignore silencieusement tout ce qui n'est pas le Price ID
 * du pack de jetons. */
async function handleJetonsTransaction(event: PaddleWebhookEvent): Promise<NextResponse> {
  // DEBUG TEMPORAIRE — le corps de cette réponse est visible directement
  // dans Paddle > Developer Tools > Notifications > Delivery log (onglet
  // Response de chaque tentative), sans avoir besoin des logs Vercel. À
  // retirer une fois le diagnostic du solde non crédité terminé.
  const debug = {
    rawItems: event.data.items,
    rawCustomData: event.data.custom_data,
    transactionId: event.data.id,
  };

  const priceId = event.data.items?.[0]?.price?.id;
  if (!priceId || !isJetonsPriceId(priceId)) {
    return NextResponse.json({ received: true, debug: { ...debug, reason: "price_id_not_matched", priceId } });
  }

  const userId = event.data.custom_data?.user_id;
  const quantity = event.data.items?.[0]?.quantity;
  if (!userId || !quantity) {
    console.error(
      "transaction.completed (jetons) sans custom_data.user_id ou quantity — impossible de créditer :",
      event.data.id,
    );
    return NextResponse.json({ received: true, debug: { ...debug, reason: "missing_user_id_or_quantity" } });
  }

  const jetonsGranted = quantity * JETONS_PER_PACK;
  const admin = createAdminClient();

  // Idempotence : Paddle peut livrer le même webhook plusieurs fois (comportement
  // normal, pas une erreur) — paddle_transaction_id UNIQUE garantit qu'on ne
  // crédite jamais deux fois le même achat. Code 23505 = violation de
  // contrainte unique (déjà traité), pas une vraie erreur.
  const { error: insertError } = await admin
    .from("jeton_purchases")
    .insert({ user_id: userId, paddle_transaction_id: event.data.id, jetons_granted: jetonsGranted });
  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true, debug: { ...debug, reason: "already_processed" } });
    }
    console.error("Impossible d'enregistrer l'achat de jetons :", insertError);
    return NextResponse.json(
      { error: "Erreur de traitement.", debug: { ...debug, reason: "insert_error", insertError } },
      { status: 500 },
    );
  }

  const { error: rpcError } = await admin.rpc("increment_purchased_jetons", {
    p_user_id: userId,
    p_amount: jetonsGranted,
  });
  if (rpcError) {
    console.error("Impossible de créditer le solde de jetons achetés :", rpcError);
    return NextResponse.json(
      { error: "Erreur de traitement.", debug: { ...debug, reason: "rpc_error", rpcError } },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true, debug: { ...debug, reason: "credited", jetonsGranted } });
}

/** Reçoit les événements Paddle (abonnement créé, mis à jour, annulé) et met
 * à jour le profil Supabase correspondant — équivalent Paddle de
 * /api/lemonsqueezy/webhook, qui reste actif en parallèle pour l'unique
 * abonné existant avant cette migration (voir @/lib/paddle, en-tête). */
export async function POST(request: Request) {
  // .trim() défensif : même classe de bug que PADDLE_API_KEY et
  // NEXT_PUBLIC_PADDLE_CLIENT_TOKEN (voir leur historique) — un copier-coller
  // depuis le dashboard Paddle vers Vercel peut laisser un caractère
  // invisible en fin de valeur, ce qui fait échouer silencieusement le calcul
  // HMAC (signature toujours rejetée en 400) sans que le secret affiché soit
  // visiblement faux.
  const secret = (process.env.PADDLE_WEBHOOK_SECRET ?? "").trim();
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

  if (event.event_type === "transaction.completed") {
    return handleJetonsTransaction(event);
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
  const quantity = event.data.items?.[0]?.quantity;
  const teamId = event.data.custom_data?.team_id;

  try {
    if (teamId) {
      // Abonnement Business Team (par siège) — voir openTeamPaddleCheckout
      // dans @/lib/paddle et TeamSubscriptionForm.
      const seatTier = priceId ? teamTierForPriceId(priceId) : null;
      if (!seatTier) {
        console.error("Price ID Paddle (équipe) non reconnu — vérifier NEXT_PUBLIC_PADDLE_PRICE_ID_TEAM_* :", priceId);
      }

      if (event.event_type === "subscription.created") {
        await admin
          .from("teams")
          .update({
            paddle_subscription_id: subscriptionId,
            paddle_customer_id: event.data.customer_id,
            subscription_status: status,
            // Nombre de sièges réellement facturé, dans la fourchette de la
            // bande choisie (Paddle valide déjà quantity.minimum/maximum au
            // checkout) — jamais absent sur .created, mais on ne remplace
            // la valeur par défaut (3) que si Paddle en fournit bien une.
            ...(quantity ? { seat_count: quantity } : {}),
          })
          .eq("id", teamId);
      } else {
        // subscription.updated / subscription.canceled : l'équipe est déjà
        // associée à cet abonnement, on la retrouve par son id Paddle —
        // même principe que pour `profiles` plus bas (jamais d'écrasement
        // par une valeur absente).
        await admin
          .from("teams")
          .update({ subscription_status: status, ...(quantity ? { seat_count: quantity } : {}) })
          .eq("paddle_subscription_id", subscriptionId);
      }
    } else {
      const tier = priceId ? tierForPriceId(priceId) : null;
      if (!tier) {
        // Ne bloque jamais l'abonné (voir plus bas, subscription_tier reste
        // simplement `null`, traité comme "intensif" par getTier dans
        // @/lib/billing) — mais un Price ID Paddle réellement facturé qui ne
        // correspond à aucun de nos 3 paliers connus indique presque toujours
        // un PADDLE_PRICE_ID_* mal configuré, à corriger.
        console.error("Price ID Paddle non reconnu — vérifier NEXT_PUBLIC_PADDLE_PRICE_ID_* :", priceId);
      }

      if (event.event_type === "subscription.created") {
        const userId = event.data.custom_data?.user_id;
        if (!userId) {
          console.error(
            "subscription.created Paddle sans custom_data.user_id/team_id — impossible de l'associer à un profil.",
          );
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
    }
  } catch (error) {
    console.error(`Erreur lors du traitement de l'événement Paddle ${event.event_type} :`, error);
    return NextResponse.json({ error: "Erreur de traitement." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
