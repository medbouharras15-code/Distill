"use client";

import { useState } from "react";
import { AiOrb } from "@/components/Brand";
import { Badge, Card, buttonClasses } from "@/components/ui";
import { FREE_GENERATIONS_LIMIT } from "@/lib/billing";
import { Check, Crown } from "@/lib/icons";
import { useSubscriptionActions } from "@/lib/useSubscriptionActions";

const freeFeatures = [`${FREE_GENERATIONS_LIMIT} générations gratuites`, "Résumés et flashcards", "Aucune carte bancaire requise"];
const proFeatures = ["Générations illimitées", "Résumés et flashcards", "Support prioritaire"];

interface SubscriptionFormProps {
  subscribed: boolean;
  remaining: number;
  checkoutStatus: "success" | "cancelled" | null;
}

/** Page dédiée à l'abonnement — voir son plan actuel, s'abonner, changer ou
 * annuler. Mêmes actions que le panneau IA de l'éditeur (@/components/notes/AiPanel),
 * via le hook partagé @/lib/useSubscriptionActions plutôt qu'une troisième
 * implémentation des mêmes appels réseau. */
export function SubscriptionForm({ subscribed, remaining, checkoutStatus }: SubscriptionFormProps) {
  const { billingLoading, billingError, setBillingError, subscribe, cancel } = useSubscriptionActions();
  const [dismissedCheckoutBanner, setDismissedCheckoutBanner] = useState(false);

  return (
    <div className="mx-auto max-w-[720px] animate-fade px-6 py-8 md:px-10 md:py-12">
      <h1 className="font-display text-4xl font-medium tracking-[-0.02em] text-foreground">Abonnement</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">Ton plan Distill, en un coup d&apos;œil.</p>

      {checkoutStatus && !dismissedCheckoutBanner && (
        <div className="mt-6 flex animate-fade items-start justify-between gap-3 rounded-xl border border-accent-light bg-accent-light/30 px-4 py-3 text-sm text-accent-dark">
          <span>
            {checkoutStatus === "success"
              ? "Merci ! Votre abonnement est en cours d'activation — cela prend quelques secondes."
              : "Paiement annulé. Vous pouvez réessayer quand vous le souhaitez."}
          </span>
          <button
            type="button"
            onClick={() => setDismissedCheckoutBanner(true)}
            className="shrink-0 text-accent-dark/70 hover:text-accent-dark"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
      )}

      {billingError && (
        <div className="mt-6 flex items-start justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{billingError}</span>
          <button type="button" onClick={() => setBillingError(null)} className="shrink-0 text-red-700/70 hover:text-red-700" aria-label="Fermer">
            ✕
          </button>
        </div>
      )}

      {/* Plan actuel */}
      <Card className="mt-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <Crown size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl font-medium text-foreground">
                  {subscribed ? "Distill Pro" : "Offre gratuite"}
                </span>
                <Badge className={subscribed ? "bg-accent-light/60 text-accent-dark" : "bg-secondary text-secondary-foreground"}>
                  Plan actuel
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {subscribed ? "9,99 € / mois" : `${remaining} génération${remaining !== 1 ? "s" : ""} gratuite${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""}`}
              </div>
            </div>
          </div>
          <button type="button" onClick={subscribed ? cancel : subscribe} disabled={billingLoading} className={buttonClasses(subscribed ? "outline" : "primary", "md")}>
            {billingLoading
              ? "Un instant…"
              : subscribed
                ? "Annuler mon abonnement"
                : "S'abonner — 9,99€/mois"}
          </button>
        </div>
      </Card>

      {/* Comparatif */}
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Card className={`p-6 ${!subscribed ? "ring-2 ring-accent" : ""}`}>
          <div className="text-sm font-medium text-muted-foreground">Gratuit</div>
          <div className="mt-2 font-display text-3xl font-medium text-foreground">0€</div>
          <ul className="mt-5 space-y-2.5">
            {freeFeatures.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-foreground/90">
                <Check size={16} className="shrink-0 text-accent-dark" /> {f}
              </li>
            ))}
          </ul>
          {!subscribed ? (
            <div className={buttonClasses("outline", "sm", "mt-6 w-full justify-center pointer-events-none opacity-60")}>Plan actuel</div>
          ) : (
            <button type="button" onClick={cancel} disabled={billingLoading} className={buttonClasses("outline", "sm", "mt-6 w-full")}>
              Rétrograder
            </button>
          )}
        </Card>

        <Card className={`p-6 ${subscribed ? "ring-2 ring-accent" : ""}`}>
          <div className="text-sm font-medium text-muted-foreground">Distill Pro</div>
          <div className="mt-2 font-display text-3xl font-medium text-foreground">
            9,99€<span className="text-base font-normal text-muted-foreground">/mois</span>
          </div>
          <ul className="mt-5 space-y-2.5">
            {proFeatures.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-foreground/90">
                <Check size={16} className="shrink-0 text-accent-dark" /> {f}
              </li>
            ))}
          </ul>
          {subscribed ? (
            <div className={buttonClasses("outline", "sm", "mt-6 w-full justify-center pointer-events-none opacity-60")}>Plan actuel</div>
          ) : (
            <button type="button" onClick={subscribe} disabled={billingLoading} className={buttonClasses("primary", "sm", "mt-6 w-full")}>
              Passer à Pro
            </button>
          )}
        </Card>
      </div>

      <div className="mt-8 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <AiOrb size={28} />
        <p className="text-xs text-muted-foreground">
          Résumés et flashcards générés par Claude (Anthropic), à partir de texte, d&apos;une photo ou d&apos;un PDF.
        </p>
      </div>
    </div>
  );
}
