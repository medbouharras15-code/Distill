"use client";

import { useState } from "react";
import { BackLink, Card, Eyebrow } from "@/components/ui";
import { Brain, Doc, FolderOpen, Users } from "@/lib/icons";

const FEATURES = [
  { icon: FolderOpen, label: "Projets & dossiers partagés", desc: "Organisez les documents par client ou sujet." },
  { icon: Brain, label: "Questions en langage naturel", desc: "« Qu'avons-nous décidé avec Nike ? »" },
  { icon: Doc, label: "Sources citées précisément", desc: "Document, page, date, auteur — toujours." },
  { icon: Users, label: "Rôles & permissions", desc: "Admin, Manager, Membre — contrôle fin." },
];

/** Paliers de tarification par siège — dégressifs par taille d'équipe.
 * Au-delà de 50 comptes, cas Enterprise à négocier séparément (pas de prix
 * public). Simulateur borné à 3-50 sièges en conséquence : au-delà, la
 * bonne réponse est "Contactez-nous", pas un chiffre calculé. */
const SEAT_TIERS = [
  { min: 3, max: 9, pricePerSeat: 8, label: "3 – 9 comptes" },
  { min: 10, max: 24, pricePerSeat: 7, label: "10 – 24 comptes" },
  { min: 25, max: 50, pricePerSeat: 6, label: "25 – 50 comptes" },
] as const;

const MIN_SEATS = 3;
const MAX_SEATS = 50;

function tierForSeats(seats: number) {
  return SEAT_TIERS.find((t) => seats >= t.min && seats <= t.max) ?? SEAT_TIERS[SEAT_TIERS.length - 1];
}

const CONTACT_EMAIL = "med.bouharras.15@gmail.com";
const CONTACT_HREF = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Offre Team Brain — demande d'information")}`;

/** Page dédiée à l'offre Team Brain (par équipe, tarif dégressif par
 * siège) — distincte des 3 paliers individuels de /subscription. Aucun
 * paiement réel : le simulateur est un pur calcul côté client, le seul
 * bouton d'action ouvre un mailto vers une adresse de contact déjà
 * utilisée ailleurs dans l'app (FAQ), pas de nouveau flux à construire. */
export function TeamSubscriptionForm() {
  const [seats, setSeats] = useState(10);
  const tier = tierForSeats(seats);
  const total = tier.pricePerSeat * seats;

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

      {/* Simulateur — pur calcul côté client (aucun appel réseau, aucun
          paiement), pour visualiser le total mensuel selon la taille de
          l'équipe avant de nous contacter. */}
      <Card className="mt-10 p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-foreground">Nombre de sièges</div>
            <div className="text-[12px] text-muted-foreground">À partir de 3 comptes</div>
          </div>
          <div className="font-display text-3xl font-medium tabular-nums text-foreground">{seats}</div>
        </div>

        <input
          type="range"
          min={MIN_SEATS}
          max={MAX_SEATS}
          value={seats}
          onChange={(e) => setSeats(Number(e.target.value))}
          className="mt-5 w-full accent-[var(--team)]"
          aria-label="Nombre de sièges"
        />

        <div className="mt-6 flex items-end justify-between gap-4 border-t border-border pt-5">
          <div>
            <div className="text-[12px] text-muted-foreground">Prix par siège</div>
            <div className="mt-0.5 font-display text-xl font-medium text-foreground">
              {tier.pricePerSeat}€<span className="text-sm font-normal text-muted-foreground">/mois</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[12px] text-muted-foreground">Total mensuel estimé</div>
            <div className="mt-0.5 font-display text-3xl font-medium tabular-nums" style={{ color: "var(--team)" }}>
              {total}€<span className="text-sm font-normal text-muted-foreground">/mois</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Grille de référence des paliers — le palier courant du simulateur
          se distingue des autres, pour relier les deux présentations. */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {SEAT_TIERS.map((t) => (
          <div
            key={t.label}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-[13px] transition-colors ${
              tier.label === t.label ? "border-[var(--team)]" : "border-border"
            }`}
            style={tier.label === t.label ? { background: "color-mix(in srgb, var(--team) 6%, var(--card))" } : undefined}
          >
            <span className="text-foreground">{t.label}</span>
            <span className="font-medium text-muted-foreground">{t.pricePerSeat}€ / mois / siège</span>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-xl border border-dashed border-border px-4 py-3 text-[13px] sm:col-span-2">
          <span className="text-foreground">Plus de 50 comptes</span>
          <span className="font-medium text-muted-foreground">Contactez-nous</span>
        </div>
      </div>

      <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[13px] font-semibold text-foreground">Prêt·e à équiper votre équipe ?</div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Pas encore de paiement en ligne pour cette offre — on met en place votre abonnement ensemble.
          </p>
        </div>
        <a
          href={CONTACT_HREF}
          className="flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_4px_16px_-6px_var(--team-glow)] transition-all duration-200 hover:-translate-y-px"
          style={{ background: "linear-gradient(135deg, var(--team) 0%, var(--team-2) 100%)" }}
        >
          Nous contacter
        </a>
      </div>
    </div>
  );
}
