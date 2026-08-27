"use client";

import Link from "next/link";
import { useState } from "react";
import { AiOrb } from "@/components/Brand";
import { Badge, Card, buttonClasses, staggerDelay } from "@/components/ui";
import type { SubscriptionProvider, SubscriptionTier } from "@/lib/billing";
import { Bolt, Brain, Check, ChevronRight, Sparkle, Star } from "@/lib/icons";
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
  /** Formats acceptés en entrée — identiques sur les 3 paliers aujourd'hui,
   * affichés sur chaque carte pour la remplir visuellement (demande
   * explicite), pas parce qu'ils diffèrent d'un palier à l'autre. */
  formats: string;
  support: string;
  highlighted?: boolean;
  premium?: boolean;
}

/** Les 3 paliers affichés, avec restriction d'accès réelle côté serveur
 * (voir getTier dans @/lib/billing, et les vérifications dans
 * /api/distill/quiz, /api/distill/chat, /api/quiz-attempts).
 *
 * Les 3 boutons "S'abonner" sont réellement fonctionnels, branchés sur
 * Paddle (voir @/lib/paddle, subscribeToTier dans
 * @/lib/useSubscriptionActions) — Essentiel et Intensif, qui n'avaient
 * jusqu'ici aucun paiement branché, le sont désormais au même titre
 * qu'Étudiant. Un seul abonné, créé avant cette migration, reste sur Lemon
 * Squeezy (voir provider ci-dessous) : ni son abonnement ni ses données ne
 * sont touchés, mais tout nouvel abonnement passe par Paddle. Le prix
 * Étudiant affiché ici (8,99$) est en avance sur le prix historique de cet
 * unique abonné Lemon Squeezy (9,99€) — sans lien entre les deux, chacun
 * facture désormais réellement le montant affiché sur sa propre carte. */
const TIERS: Tier[] = [
  {
    id: "essentiel",
    name: "Essentiel",
    priceLabel: "4,99$",
    tagline: "Pour distiller ses notes à l'essentiel.",
    icon: Sparkle,
    features: [
      { text: "Résumé & flashcards", included: true },
      { text: "QCM", included: false },
      { text: "Mode Explication (chat)", included: false },
      { text: "Détection de lacunes", included: false },
    ],
    formats: "Texte, photo, PDF",
    support: "Support standard",
  },
  {
    id: "etudiant",
    name: "Étudiant",
    priceLabel: "8,99$",
    tagline: "Le plus complet pour réviser en profondeur.",
    icon: Star,
    features: [
      { text: "Tout ce qu'il y a dans Essentiel", included: true },
      { text: "QCM (génération unique)", included: true },
      { text: "Mode Explication (chat) limité", included: true },
      { text: "Détection de lacunes", included: false },
    ],
    formats: "Texte, photo, PDF",
    support: "Support standard",
    highlighted: true,
  },
  {
    id: "intensif",
    name: "Intensif",
    priceLabel: "14,99$",
    tagline: "Pour les révisions les plus intenses.",
    icon: Bolt,
    features: [
      { text: "Tout ce qu'il y a dans Étudiant", included: true },
      { text: "QCM régénérable à volonté", included: true },
      { text: "Mode Explication (chat) illimité", included: true },
      { text: "Détection de lacunes", included: true },
    ],
    formats: "Texte, photo, PDF",
    support: "Support prioritaire",
    premium: true,
  },
];

interface SubscriptionFormProps {
  subscribed: boolean;
  tier: SubscriptionTier | null;
  provider: SubscriptionProvider;
  remaining: number;
  checkoutStatus: "success" | "cancelled" | null;
}

const TIER_NAMES: Record<SubscriptionTier, string> = {
  essentiel: "Essentiel",
  etudiant: "Étudiant",
  intensif: "Intensif",
};

/** Page dédiée à l'abonnement — 3 paliers affichés côte à côte, tous les
 * trois réellement payants via Paddle (voir TIERS ci-dessus). `provider`
 * détermine seulement quelle route d'annulation appeler pour l'abonné
 * courant (Paddle pour tout nouvel abonné, Lemon Squeezy pour l'unique
 * abonné d'avant cette migration) — voir useSubscriptionActions. */
export function SubscriptionForm({ subscribed, tier, provider, remaining, checkoutStatus }: SubscriptionFormProps) {
  const { billingLoading, billingError, setBillingError, subscribeToTier, cancel } = useSubscriptionActions(provider);
  const [dismissedCheckoutBanner, setDismissedCheckoutBanner] = useState(false);

  return (
    <div className="mx-auto max-w-[1080px] animate-fade px-6 py-8 md:px-10 md:py-12">
      <div className="text-center">
        <h1 className="font-display text-4xl font-medium tracking-[-0.02em] text-foreground">Abonnement</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Choisis le palier adapté à ton rythme de révision.
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {subscribed && tier
            ? `Tu es actuellement sur le palier ${TIER_NAMES[tier]}.`
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

      {/* Offre équipe, distincte des 3 paliers individuels ci-dessous
          (tarif dégressif par siège plutôt qu'un prix fixe) — bannière à
          part avec l'identité bleue de Team Brain plutôt qu'une 4e carte
          dans une grille pensée pour comparer des offres individuelles.
          Placée au-dessus de la grille (plutôt qu'en dessous) pour que
          l'offre équipe soit visible dès l'arrivée sur la page. */}
      <Link
        href="/subscription/team"
        className="group mt-8 flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-md)]"
      >
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
          style={{ background: "linear-gradient(135deg, var(--team) 0%, var(--team-2) 100%)" }}
        >
          <Brain size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-base font-medium text-foreground">Business Team</div>
          <div className="mt-0.5 text-[13px] text-muted-foreground">
            Une mémoire collective d&apos;équipe, interrogeable par IA — tarif dégressif par siège.
          </div>
        </div>
        <span className="hidden shrink-0 items-center gap-1 text-sm font-medium sm:flex" style={{ color: "var(--team)" }}>
          Découvrir l&apos;offre
          <ChevronRight
            size={16}
            className="transition-transform duration-200 group-hover:translate-x-0.5"
            style={{ transitionTimingFunction: "var(--ease-signature)" }}
          />
        </span>
      </Link>

      <div className="mt-6 grid items-stretch gap-6 md:grid-cols-3">
        {TIERS.map((tierCard, i) => {
          const Icon = tierCard.icon;
          const isCurrentPlan = subscribed && tier === tierCard.id;

          return (
            <div
              key={tierCard.id}
              className={`relative animate-fade ${tierCard.highlighted ? "md:-translate-y-3 md:scale-[1.02]" : ""}`}
              style={staggerDelay(i, 90)}
            >
              {tierCard.highlighted && (
                <div className="absolute inset-x-4 -inset-y-2 -z-10 rounded-[calc(var(--radius)+14px)] bg-accent/25 blur-2xl" aria-hidden="true" />
              )}
              {tierCard.highlighted && (
                <Badge className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 bg-accent text-[var(--primary-foreground)] shadow-[var(--shadow-md)]">
                  ✦ Recommandé
                </Badge>
              )}

              <Card
                className={`paper-grain card-hover flex h-full flex-col overflow-hidden p-6 ${
                  tierCard.highlighted
                    ? "border-accent ring-2 ring-accent"
                    : tierCard.premium
                      ? "border-amber-300/70 bg-gradient-to-b from-amber-50/50 to-card"
                      : ""
                }`}
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                    tierCard.premium
                      ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white"
                      : tierCard.highlighted
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-foreground/70"
                  }`}
                >
                  <Icon size={20} />
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <span className="font-display text-xl font-medium text-foreground">{tierCard.name}</span>
                  {isCurrentPlan && (
                    <Badge className="bg-accent-light/60 text-accent-dark">Plan actuel</Badge>
                  )}
                </div>
                <p className="mt-1 text-[13px] text-muted-foreground">{tierCard.tagline}</p>

                <div className="mt-5 font-display text-3xl font-medium text-foreground">
                  {tierCard.priceLabel}
                  <span className="text-base font-normal text-muted-foreground">/mois</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge className="bg-secondary text-secondary-foreground">{tierCard.formats}</Badge>
                  <Badge className="bg-secondary text-secondary-foreground">{tierCard.support}</Badge>
                </div>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {tierCard.features.map((f) => (
                    <li
                      key={f.text}
                      className={`flex items-center gap-2.5 text-sm ${f.included ? "text-foreground/90" : "text-muted-foreground/60 line-through"}`}
                    >
                      {f.included ? (
                        <Check size={16} className={`shrink-0 ${tierCard.premium ? "text-amber-600" : "text-accent-dark"}`} />
                      ) : (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground/50">✕</span>
                      )}
                      {f.text}
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
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
                    onClick={() => void subscribeToTier(tierCard.id)}
                    disabled={billingLoading || subscribed}
                    className={buttonClasses("primary", "sm", "mt-6 w-full")}
                  >
                    {billingLoading ? "Un instant…" : "S'abonner"}
                  </button>
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
