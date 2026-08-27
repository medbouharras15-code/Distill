/**
 * Intégration Paddle Billing — remplace progressivement Lemon Squeezy (voir
 * @/lib/lemonsqueezy, conservé tel quel pour l'unique abonné existant avant
 * cette migration, voir /api/lemonsqueezy/* et /api/paddle/*).
 *
 * Contrairement à Lemon Squeezy (redirection vers une page hébergée créée
 * par le serveur), Paddle recommande un paiement en overlay géré entièrement
 * côté client via Paddle.js — ce fichier n'est donc volontairement pas
 * server-only comme @/lib/lemonsqueezy : tout ce qu'il exporte doit rester
 * appelable aussi bien depuis un composant "use client" (déclenchement du
 * paiement) que depuis une route serveur (le webhook, pour retrouver le
 * palier correspondant à un prix Paddle reçu). Rien de sensible ici — les
 * Price ID et le token client Paddle.js ne sont pas des secrets, seuls
 * PADDLE_API_KEY et PADDLE_WEBHOOK_SECRET le sont (jamais lus ici, seulement
 * dans /api/paddle/webhook et /api/paddle/cancel).
 */
import type { SubscriptionTier } from "@/lib/billing";

export const PADDLE_ENVIRONMENT = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox";

/** Base de l'API REST Paddle — distincte entre sandbox et production
 * (contrairement à Lemon Squeezy, qui n'a qu'une seule URL d'API pour les
 * deux). Utilisée uniquement côté serveur (/api/paddle/cancel). */
export const PADDLE_API_BASE =
  PADDLE_ENVIRONMENT === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";

export const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";

/** Un Price ID par palier (voir SubscriptionForm) — configurés dans le
 * dashboard Paddle, un produit + un prix récurrent par palier. */
export const PADDLE_PRICE_IDS: Record<SubscriptionTier, string> = {
  essentiel: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_ESSENTIEL ?? "",
  etudiant: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_ETUDIANT ?? "",
  intensif: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_INTENSIF ?? "",
};

/** Retrouve le palier à partir d'un Price ID Paddle réellement acheté (voir
 * le webhook /api/paddle/webhook) — source de vérité plus fiable que de
 * faire confiance à un `tier` transmis dans custom_data, puisqu'elle reflète
 * ce que Paddle a effectivement facturé plutôt qu'une donnée qu'on a
 * nous-mêmes fournie au moment du checkout. */
export function tierForPriceId(priceId: string): SubscriptionTier | null {
  const entry = (Object.entries(PADDLE_PRICE_IDS) as [SubscriptionTier, string][]).find(
    ([, id]) => id && id === priceId,
  );
  return entry ? entry[0] : null;
}

/** Espace de noms minimal des méthodes Paddle.js réellement utilisées ici —
 * pas la peine d'ajouter le SDK npm officiel pour appeler 3 méthodes sur un
 * global injecté par <script>. */
interface PaddleGlobal {
  Environment: { set(env: "sandbox" | "production"): void };
  Initialize(options: { token: string }): void;
  Checkout: {
    open(options: {
      items: { priceId: string; quantity: number }[];
      customData?: Record<string, string>;
      settings?: { displayMode?: "overlay"; theme?: "light" | "dark"; successUrl?: string };
    }): void;
  };
}

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

const PADDLE_JS_SRC = "https://cdn.paddle.com/paddle/v2/paddle.js";

let paddleReady: Promise<PaddleGlobal> | null = null;

/** Charge Paddle.js (une seule fois, même si appelée plusieurs fois — voir
 * le cache `paddleReady`) et l'initialise avec le token client et le bon
 * environnement. Doit être appelée avant tout Paddle.Checkout.open(). */
function loadPaddle(): Promise<PaddleGlobal> {
  if (paddleReady) return paddleReady;

  paddleReady = new Promise((resolve, reject) => {
    if (window.Paddle) {
      resolve(window.Paddle);
      return;
    }

    const script = document.createElement("script");
    script.src = PADDLE_JS_SRC;
    script.async = true;
    script.onload = () => {
      if (!window.Paddle) {
        reject(new Error("Paddle.js chargé mais l'objet global Paddle est introuvable."));
        return;
      }
      // L'environnement doit être fixé avant Initialize, voir la doc Paddle.
      if (PADDLE_ENVIRONMENT === "sandbox") {
        window.Paddle.Environment.set("sandbox");
      }
      window.Paddle.Initialize({ token: PADDLE_CLIENT_TOKEN });
      resolve(window.Paddle);
    };
    script.onerror = () => reject(new Error("Impossible de charger Paddle.js."));
    document.head.appendChild(script);
  });

  return paddleReady;
}

/** Ouvre l'overlay de paiement Paddle pour le palier demandé. `userId` est
 * transmis en custom_data : c'est le seul moyen pour le webhook (voir
 * /api/paddle/webhook) de savoir à quel profil rattacher l'abonnement créé,
 * Paddle ne connaissant pas nos comptes utilisateurs. */
export async function openPaddleCheckout({
  tier,
  priceId,
  userId,
  successUrl,
}: {
  tier: SubscriptionTier;
  priceId: string;
  userId: string;
  successUrl: string;
}): Promise<void> {
  const paddle = await loadPaddle();
  paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customData: { user_id: userId, tier },
    settings: { displayMode: "overlay", successUrl },
  });
}
