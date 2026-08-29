"use client";

import { useState } from "react";
import type { SubscriptionProvider, SubscriptionTier } from "@/lib/billing";
import { openJetonsPurchase, openPaddleCheckout, openTeamPaddleCheckout } from "@/lib/paddle";

/** Lit une réponse HTTP comme du JSON, en donnant un message clair si le
 * serveur (ou une plateforme intermédiaire comme Vercel) a renvoyé autre
 * chose que du JSON — par exemple après un délai d'exécution dépassé.
 * Exportée pour être réutilisée par les autres appels réseau du panneau IA
 * (/api/distill), qui ont besoin de la même robustesse. */
export async function parseJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const raw = await res.text();
  try {
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    throw new Error(
      res.ok
        ? "Réponse du serveur illisible. Réessayez."
        : `Le serveur a mis trop de temps à répondre ou a rejeté la requête (code ${res.status}). Réessayez avec un fichier plus léger.`,
    );
  }
}

/** Actions d'abonnement (souscrire / annuler), partagées par le panneau IA de
 * l'éditeur (@/components/notes/AiPanel) et la page Abonnement dédiée
 * (@/app/(app)/subscription), pour n'avoir qu'une seule implémentation
 * plutôt que deux copies divergentes.
 *
 * Migration Paddle en cours (voir @/lib/paddle) : `subscribe` (Lemon
 * Squeezy) reste défini ci-dessous mais n'est plus appelé par aucun bouton
 * — tout nouvel abonnement passe désormais par `subscribeToTier` (Paddle).
 * Lemon Squeezy est conservé uniquement pour permettre à l'unique abonné
 * d'avant cette migration d'annuler son abonnement (`cancel`, qui choisit
 * la bonne route selon `provider`, voir getSubscriptionProvider dans
 * @/lib/billing) — jamais pour créer un nouvel abonnement.
 *
 * `paddleCustomerId` (profiles.paddle_customer_id) est transmis à
 * openPaddleCheckout pour Paddle Retain — voir sa doc dans @/lib/paddle. */
export function useSubscriptionActions(provider: SubscriptionProvider = null, paddleCustomerId: string | null = null) {
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  async function subscribe() {
    if (billingLoading) return;
    setBillingLoading(true);
    setBillingError(null);
    try {
      const res = await fetch("/api/lemonsqueezy/checkout", { method: "POST" });
      const payload = await parseJsonResponse(res);
      if (!res.ok || typeof payload.url !== "string") {
        throw new Error(typeof payload.error === "string" ? payload.error : "Impossible de démarrer le paiement.");
      }
      // Redirige vers la page hébergée par Lemon Squeezy : la carte bancaire
      // y est saisie directement, elle ne transite jamais par notre serveur.
      window.location.href = payload.url;
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setBillingLoading(false);
    }
  }

  /** Ouvre l'overlay de paiement Paddle pour le palier choisi — voir
   * /api/paddle/checkout-init (récupère l'id utilisateur et le Price ID) et
   * openPaddleCheckout dans @/lib/paddle (charge Paddle.js et ouvre le
   * paiement). Contrairement à `subscribe` ci-dessus, il n'y a pas de
   * redirection immédiate : l'overlay reste ouvert sur place, on arrête
   * l'indicateur de chargement dès qu'il est affiché plutôt que d'attendre
   * la fin du paiement (aucun signal synchrone pour ça côté client, le
   * webhook Paddle s'en charge en arrière-plan). */
  async function subscribeToTier(tier: SubscriptionTier) {
    if (billingLoading) return;
    setBillingLoading(true);
    setBillingError(null);
    try {
      const res = await fetch("/api/paddle/checkout-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const payload = await parseJsonResponse(res);
      if (!res.ok || typeof payload.userId !== "string" || typeof payload.priceId !== "string") {
        throw new Error(typeof payload.error === "string" ? payload.error : "Impossible de démarrer le paiement.");
      }
      const successUrl = `${window.location.origin}${window.location.pathname}?checkout=success`;
      await openPaddleCheckout({
        tier,
        priceId: payload.priceId,
        userId: payload.userId,
        successUrl,
        paddleCustomerId,
        // Remonte l'erreur précise de Paddle (code + détail) dans le même
        // message d'erreur affiché à l'écran — sans ça, impossible de
        // diagnostiquer depuis un appareil sans console navigateur (iPad...).
        onError: (error) => setBillingError(`Paddle : ${error.detail} (code : ${error.code})`),
        // Filet de secours : le contenu brut de la requête réseau en échec,
        // pour les cas où checkout.error ne se déclenche pas du tout.
        onNetworkError: (info) => setBillingError(`Requête Paddle en échec :\n${info}`),
      });
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBillingLoading(false);
    }
  }

  async function cancel() {
    if (billingLoading) return;
    if (!window.confirm("Annuler votre abonnement Distill ? L'accès illimité s'arrêtera immédiatement.")) {
      return;
    }
    setBillingLoading(true);
    setBillingError(null);
    try {
      const path = provider === "paddle" ? "/api/paddle/cancel" : "/api/lemonsqueezy/cancel";
      const res = await fetch(path, { method: "POST" });
      const payload = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Impossible d'annuler l'abonnement.");
      }
      // Recharge la page pour refléter le nouveau statut (recalculé côté
      // serveur).
      window.location.reload();
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setBillingLoading(false);
    }
  }

  return { billingLoading, billingError, setBillingError, subscribe, subscribeToTier, cancel };
}

/** Actions d'abonnement pour l'offre Business Team (par siège) — pendant de
 * useSubscriptionActions ci-dessus pour les 3 paliers individuels, mais
 * routes et payloads distincts (team-checkout-init/team-cancel, quantité de
 * sièges plutôt que palier fixe) : voir TeamSubscriptionForm. */
export function useTeamSubscriptionActions(paddleCustomerId: string | null = null) {
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  /** Même principe que subscribeToTier ci-dessus (voir son commentaire) :
   * /api/paddle/team-checkout-init résout l'équipe active de l'utilisateur
   * et le Price ID de la bande correspondant au nombre de sièges choisi. */
  async function subscribeTeam(seats: number) {
    if (billingLoading) return;
    setBillingLoading(true);
    setBillingError(null);
    try {
      const res = await fetch("/api/paddle/team-checkout-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seats }),
      });
      const payload = await parseJsonResponse(res);
      if (!res.ok || typeof payload.teamId !== "string" || typeof payload.priceId !== "string") {
        throw new Error(typeof payload.error === "string" ? payload.error : "Impossible de démarrer le paiement.");
      }
      const successUrl = `${window.location.origin}${window.location.pathname}?checkout=success`;
      await openTeamPaddleCheckout({
        teamId: payload.teamId,
        priceId: payload.priceId,
        seats,
        successUrl,
        paddleCustomerId,
        onError: (error) => setBillingError(`Paddle : ${error.detail} (code : ${error.code})`),
        onNetworkError: (info) => setBillingError(`Requête Paddle en échec :\n${info}`),
      });
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBillingLoading(false);
    }
  }

  async function cancelTeam() {
    if (billingLoading) return;
    if (
      !window.confirm("Annuler l'abonnement Business Team ? L'accès aux sièges payants s'arrêtera immédiatement.")
    ) {
      return;
    }
    setBillingLoading(true);
    setBillingError(null);
    try {
      const res = await fetch("/api/paddle/team-cancel", { method: "POST" });
      const payload = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Impossible d'annuler l'abonnement.");
      }
      window.location.reload();
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setBillingLoading(false);
    }
  }

  return { billingLoading, billingError, setBillingError, subscribeTeam, cancelTeam };
}

/** Achat de jetons à la carte (produit Paddle one-time, réservé aux abonnés
 * Essentiel/Étudiant — voir /api/paddle/jetons-checkout-init) — même
 * principe que les autres hooks de ce fichier, mais pas de `cancel` (un
 * achat one-time n'est pas un abonnement, rien à résilier). */
export function useJetonsPurchaseActions(paddleCustomerId: string | null = null) {
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  async function buyJetons(quantity: number) {
    if (billingLoading) return;
    setBillingLoading(true);
    setBillingError(null);
    try {
      const res = await fetch("/api/paddle/jetons-checkout-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      const payload = await parseJsonResponse(res);
      if (
        !res.ok ||
        typeof payload.userId !== "string" ||
        typeof payload.priceId !== "string" ||
        typeof payload.quantity !== "number"
      ) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Impossible de démarrer le paiement.");
      }
      const successUrl = `${window.location.origin}${window.location.pathname}?checkout=success`;
      await openJetonsPurchase({
        userId: payload.userId,
        quantity: payload.quantity,
        successUrl,
        paddleCustomerId,
        onError: (error) => setBillingError(`Paddle : ${error.detail} (code : ${error.code})`),
        onNetworkError: (info) => setBillingError(`Requête Paddle en échec :\n${info}`),
      });
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBillingLoading(false);
    }
  }

  return { billingLoading, billingError, setBillingError, buyJetons };
}
