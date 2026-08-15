"use client";

import { useState } from "react";

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

/** Actions d'abonnement (souscrire / annuler) — mêmes appels réseau
 * (/api/lemonsqueezy/checkout, /api/lemonsqueezy/cancel) partagés par le
 * panneau IA de l'éditeur (@/components/notes/AiPanel) et la page Abonnement
 * dédiée (@/app/(app)/subscription), pour n'avoir qu'une seule
 * implémentation plutôt que deux copies divergentes. */
export function useSubscriptionActions() {
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

  async function cancel() {
    if (billingLoading) return;
    if (!window.confirm("Annuler votre abonnement Distill ? L'accès illimité s'arrêtera immédiatement.")) {
      return;
    }
    setBillingLoading(true);
    setBillingError(null);
    try {
      const res = await fetch("/api/lemonsqueezy/cancel", { method: "POST" });
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

  return { billingLoading, billingError, setBillingError, subscribe, cancel };
}
