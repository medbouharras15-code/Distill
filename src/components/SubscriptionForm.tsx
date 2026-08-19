"use client";

import { useState } from "react";
import { AiOrb } from "@/components/Brand";
import { Badge, Card, buttonClasses, staggerDelay } from "@/components/ui";
import { Bolt, Check, Sparkle, Star } from "@/lib/icons";
import { useSubscriptionActions } from "@/lib/useSubscriptionActions";

interface TierFeature {
  text: string;
  included: boolean;
}

interface Tier {
  id: "essentiel" | "etudiant" | "intensif";
  name: string;
  priceLabel: string;
  tagline: string;
  icon: typeof Sparkle;
  features: TierFeature[];
  highlighted?: boolean;
  premium?: boolean;
}

/** Les 3 paliers affichés. "etudiant" est le seul relié à un vrai flux de
 * paiement (Lemon Squeezy, voir plus bas) : c'est exactement l'offre unique
 * déjà en place aujourd'hui (9,99€/mois), juste réintégrée dans cette
 * nouvelle mise en page à 3 colonnes. "essentiel" et "intensif" sont de
 * nouveaux paliers sans prix configuré chez le prestataire actuel — leurs
 * boutons restent volontairement non fonctionnels ("Bientôt disponible") en
 * attendant le changement de prestataire évoqué par l'utilisateur. */
const TIERS: Tier[] = [
  {
    id: "essentiel",
    name: "Essentiel",
    priceLabel: "4,99€",
    tagline: "Pour distiller ses notes à l'essentiel.",
    icon: Sparkle,
    features: [
      { text: "Résumé, flashcards & QCM", included: true },
      { text: "Générations illimitées", included: true },
      { text: "Mode Explication (chat)", included: false },
    ],
  },
  {
    id: "etudiant",
    name: "Étudiant",
    priceLabel: "9,99€",
    tagline: "Le plus complet pour réviser en profondeur.",
    icon: Star,
    features: [
      { text: "Tout ce qu'il y a dans Essentiel", included: true },
      { text: "Mode Explication (chat) inclus", included: true },
    ],
    highlighted: true,
  },
  {
    id: "intensif",
    name: "Intensif",
    priceLabel: "19,99€",
    tagline: "Pour les révisions les plus intenses.",
    icon: Bolt,
    features: [
      { text: "Tout ce qu'il y a dans Étudiant", included: true },
      { text: "Priorité de traitement", included: true },
      { text: "Accès anticipé aux nouveautés", included: true },
    ],
    premium: true,
  },
];

interface SubscriptionFormProps {
  subscribed: boolean;
  remaining: number;
  checkoutStatus: "success" | "cancelled" | null;
}

/** Page dédiée à l'abonnement — 3 paliers affichés côte à côte. Seul le
 * palier "Étudiant" (9,99€) correspond à une offre réellement payante
 * aujourd'hui : son bouton reste connecté au vrai flux Lemon Squeezy via
 * @/lib/useSubscriptionActions, partagé avec le panneau IA de l'éditeur
 * (@/components/notes/AiPanel). "Essentiel" et "Intensif" sont de nouveaux
 * paliers sans paiement branché pour l'instant (voir TIERS ci-dessus). */
export function SubscriptionForm({ subscribed, remaining, checkoutStatus }: SubscriptionFormProps) {
  const { billingLoading, billingError, setBillingError, subscribe, cancel } = useSubscriptionActions();
  const [dismissedCheckoutBanner, setDismissedCheckoutBanner] = useState(false);

  return (
    <div className="mx-auto max-w-[1080px] animate-fade px-6 py-8 md:px-10 md:py-12">
      <div className="text-center">
        <h1 className="font-display text-4xl font-medium tracking-[-0.02em] text-foreground">Abonnement</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Choisis le palier adapté à ton rythme de révision.
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {subscribed
            ? "Tu es actuellement sur le palier Étudiant."
            : `Offre gratuite en cours — ${remaining} génération${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""}.`}
        </p>
      </div>

      {checkoutStatus && !dismissedCheckoutBanner && (
        <div className="mx-auto mt-6 flex max-w-[640px] animate-fade items-start justify-between gap-3 rounded-xl border border-accent-light bg-accent-light/30 px-4 py-3 text-sm text-accent-dark">
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
        <div className="mx-auto mt-6 flex max-w-[640px] items-start justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{billingError}</span>
          <button
            type="button"
            onClick={() => setBillingError(null)}
            className="shrink-0 text-red-700/70 hover:text-red-700"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
      )}

      <div className="mt-10 grid items-stretch gap-6 md:grid-cols-3">
        {TIERS.map((tier, i) => {
          const Icon = tier.icon;
          const isCurrentPlan = tier.id === "etudiant" && subscribed;

          return (
            <div
              key={tier.id}
              className={`relative animate-fade ${tier.highlighted ? "md:-translate-y-3 md:scale-[1.02]" : ""}`}
              style={staggerDelay(i, 90)}
            >
              {tier.highlighted && (
                <div className="absolute inset-x-4 -inset-y-2 -z-10 rounded-[calc(var(--radius)+14px)] bg-accent/25 blur-2xl" aria-hidden="true" />
              )}
              {tier.highlighted && (
                <Badge className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 bg-accent text-[var(--primary-foreground)] shadow-[var(--shadow-md)]">
                  ✦ Recommandé
                </Badge>
              )}

              <Card
                className={`paper-grain card-hover flex h-full flex-col overflow-hidden p-6 ${
                  tier.highlighted
                    ? "border-accent ring-2 ring-accent"
                    : tier.premium
                      ? "border-amber-300/70 bg-gradient-to-b from-amber-50/50 to-card"
                      : ""
                }`}
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                    tier.premium
                      ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white"
                      : tier.highlighted
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-foreground/70"
                  }`}
                >
                  <Icon size={20} />
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <span className="font-display text-xl font-medium text-foreground">{tier.name}</span>
                  {isCurrentPlan && (
                    <Badge className="bg-accent-light/60 text-accent-dark">Plan actuel</Badge>
                  )}
                </div>
                <p className="mt-1 text-[13px] text-muted-foreground">{tier.tagline}</p>

                <div className="mt-5 font-display text-3xl font-medium text-foreground">
                  {tier.priceLabel}
                  <span className="text-base font-normal text-muted-foreground">/mois</span>
                </div>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {tier.features.map((f) => (
                    <li
                      key={f.text}
                      className={`flex items-center gap-2.5 text-sm ${f.included ? "text-foreground/90" : "text-muted-foreground/60 line-through"}`}
                    >
                      {f.included ? (
                        <Check size={16} className={`shrink-0 ${tier.premium ? "text-amber-600" : "text-accent-dark"}`} />
                      ) : (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground/50">✕</span>
                      )}
                      {f.text}
                    </li>
                  ))}
                </ul>

                {tier.id === "etudiant" ? (
                  isCurrentPlan ? (
                    <button
                      type="button"
                      onClick={cancel}
                      disabled={billingLoading}
                      className={buttonClasses("outline", "sm", "mt-6 w-full")}
                    >
                      {billingLoading ? "Un instant…" : "Annuler mon abonnement"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={subscribe}
                      disabled={billingLoading}
                      className={buttonClasses("primary", "sm", "mt-6 w-full")}
                    >
                      {billingLoading ? "Un instant…" : "S'abonner"}
                    </button>
                  )
                ) : (
                  <div className={buttonClasses("outline", "sm", "mt-6 w-full justify-center pointer-events-none opacity-60")}>
                    Bientôt disponible
                  </div>
                )}
              </Card>
            </div>
          );
        })}
      </div>

      <div className="mt-10 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <AiOrb size={28} />
        <p className="text-xs text-muted-foreground">
          Résumés, flashcards et QCM générés par Claude (Anthropic), à partir de texte, d&apos;une photo ou d&apos;un PDF.
        </p>
      </div>
    </div>
  );
}
