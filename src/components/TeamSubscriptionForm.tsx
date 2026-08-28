"use client";

import Link from "next/link";
import { useState } from "react";
import { BackLink, Button, Card, Eyebrow } from "@/components/ui";
import { Brain, Doc, FolderOpen, Users } from "@/lib/icons";
import { TEAM_SEAT_TIERS, teamTierForSeats } from "@/lib/paddle";
import { useTeamSubscriptionActions } from "@/lib/useSubscriptionActions";
import type { Team } from "@/lib/types";

const FEATURES = [
  { icon: FolderOpen, label: "Projets & dossiers partagés", desc: "Organisez les documents par client ou sujet." },
  { icon: Brain, label: "Questions en langage naturel", desc: "« Qu'avons-nous décidé avec Nike ? »" },
  { icon: Doc, label: "Sources citées précisément", desc: "Document, page, date, auteur — toujours." },
  { icon: Users, label: "Rôles & permissions", desc: "Admin, Manager, Membre — contrôle fin." },
];

const MIN_SEATS = TEAM_SEAT_TIERS[0].min;
const MAX_SEATS = TEAM_SEAT_TIERS[TEAM_SEAT_TIERS.length - 1].max;

interface TeamSubscriptionFormProps {
  /** `null` tant que l'utilisateur connecté n'a aucune équipe (voir
   * getUserActiveTeam côté page) — aucune création d'équipe ici, seulement
   * un renvoi vers /team-brain. */
  team: Team | null;
  /** Seul le propriétaire de l'équipe (teams.owner_id) peut gérer sa
   * facturation — un membre/admin ordinaire ne le peut pas. */
  isOwner: boolean;
  paddleCustomerId: string | null;
  checkoutStatus: "success" | "cancelled" | null;
}

/** Page dédiée à l'offre Team Brain (par équipe, tarif dégressif par
 * siège), réellement payante via Paddle depuis cette migration — un seul
 * produit Paddle, trois Price ID à quantité variable (voir TEAM_SEAT_TIERS
 * dans @/lib/paddle), Paddle calculant lui-même unit_price × quantité de
 * sièges. Simulateur borné à 3-50 sièges : au-delà, cas Enterprise à
 * négocier séparément (pas de prix public, voir carte de contact finale,
 * conservée telle quelle). */
export function TeamSubscriptionForm({ team, isOwner, paddleCustomerId, checkoutStatus }: TeamSubscriptionFormProps) {
  const subscribed = team?.subscription_status === "active";
  const [selectedSeats, setSelectedSeats] = useState(10);
  const seats = subscribed && team ? team.seat_count : selectedSeats;
  const seatTier = teamTierForSeats(seats);
  const total = seatTier.pricePerSeat * seats;

  const { billingLoading, billingError, setBillingError, subscribeTeam, cancelTeam } =
    useTeamSubscriptionActions(paddleCustomerId);
  const [dismissedCheckoutBanner, setDismissedCheckoutBanner] = useState(false);

  return (
    <div className="mx-auto max-w-[860px] animate-fade px-6 py-8 md:px-10 md:py-12">
      <BackLink href="/subscription" className="mb-8">
        Abonnement
      </BackLink>

      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-[0_4px_20px_-6px_var(--team-glow)]"
          style={{ background: "linear-gradient(135deg, var(--team) 0%, var(--team-2) 100%)" }}
        >
          <Brain size={22} />
        </div>
        <Eyebrow>Team Brain — Business Team</Eyebrow>
      </div>

      <h1 className="mt-4 font-display text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-4xl">
        Une mémoire collective pour toute l&apos;équipe.
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] leading-relaxed text-muted-foreground">
        Chaque membre ajoute ses notes et documents ; l&apos;IA répond aux questions de toute l&apos;équipe en citant
        la source exacte — jamais de réponse inventée. Un tarif qui baisse à mesure que l&apos;équipe grandit.
      </p>

      {checkoutStatus && !dismissedCheckoutBanner && (
        <div className="mx-auto mt-6 flex max-w-[640px] animate-fade items-start justify-between gap-3 rounded-xl border border-accent-light bg-accent-light/30 px-4 py-3 text-sm text-accent-dark">
          <span>
            {checkoutStatus === "success"
              ? "Merci ! L'abonnement de votre équipe est en cours d'activation — cela prend quelques secondes."
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

      {/* Fonctionnalités — icône + texte sans encadré, même traitement que
          l'écran Verrouillé de Team Brain plutôt qu'une nouvelle grille de
          cartes. */}
      <div className="mt-9 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: "color-mix(in srgb, var(--team) 85%, var(--team-2))" }}
            >
              <Icon size={15} />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-foreground">{label}</div>
              <div className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Simulateur (S'abonner pas encore actif) / récapitulatif (déjà
          abonné) — le curseur devient un simple affichage, non éditable,
          une fois abonné : ni upgrade ni downgrade de sièges pour l'instant
          (même choix que les 3 paliers individuels). */}
      <Card className="mt-10 p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-foreground">
              {subscribed ? "Sièges de votre équipe" : "Nombre de sièges"}
            </div>
            <div className="text-[12px] text-muted-foreground">À partir de {MIN_SEATS} comptes</div>
          </div>
          <div className="font-display text-3xl font-medium tabular-nums text-foreground">{seats}</div>
        </div>

        <input
          type="range"
          min={MIN_SEATS}
          max={MAX_SEATS}
          value={seats}
          disabled={subscribed}
          onChange={(e) => setSelectedSeats(Number(e.target.value))}
          className="mt-5 w-full accent-[var(--team)] disabled:opacity-50"
          aria-label="Nombre de sièges"
        />

        <div className="mt-6 flex items-end justify-between gap-4 border-t border-border pt-5">
          <div>
            <div className="text-[12px] text-muted-foreground">Prix par siège</div>
            <div className="mt-0.5 font-display text-xl font-medium text-foreground">
              {seatTier.pricePerSeat}€<span className="text-sm font-normal text-muted-foreground">/mois</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[12px] text-muted-foreground">
              {subscribed ? "Total mensuel" : "Total mensuel estimé"}
            </div>
            <div className="mt-0.5 font-display text-3xl font-medium tabular-nums" style={{ color: "var(--team)" }}>
              {total}€<span className="text-sm font-normal text-muted-foreground">/mois</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Grille de référence des paliers — le palier courant du simulateur
          se distingue des autres, pour relier les deux présentations. */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {TEAM_SEAT_TIERS.map((t) => (
          <div
            key={`${t.min}-${t.max}`}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-[13px] transition-colors ${
              seatTier.min === t.min ? "border-[var(--team)]" : "border-border"
            }`}
            style={seatTier.min === t.min ? { background: "color-mix(in srgb, var(--team) 6%, var(--card))" } : undefined}
          >
            <span className="text-foreground">
              {t.min} – {t.max} comptes
            </span>
            <span className="font-medium text-muted-foreground">{t.pricePerSeat}€ / mois / siège</span>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-xl border border-dashed border-border px-4 py-3 text-[13px] sm:col-span-2">
          <span className="text-foreground">Plus de {MAX_SEATS} comptes</span>
          <span className="font-medium text-muted-foreground">Contactez-nous</span>
        </div>
      </div>

      {billingError && (
        <div className="mx-auto mt-4 flex max-w-[640px] items-start justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="whitespace-pre-wrap break-words">{billingError}</span>
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

      {!team ? (
        <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[13px] font-semibold text-foreground">Créez d&apos;abord votre équipe</div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              L&apos;abonnement Business Team se rattache à une équipe existante — créez la vôtre gratuitement, puis
              revenez ici pour l&apos;abonner.
            </p>
          </div>
          <Link
            href="/team-brain"
            className="flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_4px_16px_-6px_var(--team-glow)] transition-all duration-200 hover:-translate-y-px"
            style={{ background: "linear-gradient(135deg, var(--team) 0%, var(--team-2) 100%)" }}
          >
            Créer mon équipe
          </Link>
        </div>
      ) : !isOwner ? (
        <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-[13px] text-muted-foreground">
          Seul·e le/la propriétaire de l&apos;équipe <span className="font-medium text-foreground">{team.name}</span>{" "}
          peut gérer son abonnement.
        </div>
      ) : (
        <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[13px] font-semibold text-foreground">
              {subscribed ? `Abonnement actif — ${team.seat_count} sièges` : "Prêt·e à équiper votre équipe ?"}
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {subscribed
                ? "Vous pouvez annuler à tout moment ; l'accès aux sièges payants s'arrête immédiatement."
                : "Paiement sécurisé par Paddle, résiliable à tout moment."}
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            disabled={billingLoading}
            onClick={() => void (subscribed ? cancelTeam() : subscribeTeam(seats))}
            className="shrink-0"
            style={{ background: subscribed ? undefined : "linear-gradient(135deg, var(--team) 0%, var(--team-2) 100%)" }}
          >
            {billingLoading ? "…" : subscribed ? "Annuler mon abonnement" : "S'abonner"}
          </Button>
        </div>
      )}
    </div>
  );
}
