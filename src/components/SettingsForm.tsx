"use client";

import { useState } from "react";
import Link from "next/link";
import { AiOrb } from "@/components/Brand";
import { Badge, Button, Card, buttonClasses } from "@/components/ui";
import type { MonthlyUsageSummary } from "@/lib/aiUsage";
import { IS_SUBSCRIBED_OVERRIDDEN } from "@/lib/billing";
import { Bell, Check, Contrast, Crown, LogOut, Pen, Shield, Users } from "@/lib/icons";
import { setDarkMode, useIsDarkMode } from "@/lib/useTheme";

type SettingsSection = "compte" | "apparence" | "ia" | "notifications" | "abonnement" | "confidentialite" | "securite";

const sections: { id: SettingsSection; label: string; icon: typeof Users | null; desc: string }[] = [
  { id: "compte", label: "Compte", icon: Users, desc: "Profil et informations" },
  { id: "apparence", label: "Apparence", icon: Contrast, desc: "Thème et affichage" },
  { id: "ia", label: "IA Distill", icon: null, desc: "Suggestions et modèle" },
  { id: "notifications", label: "Notifications", icon: Bell, desc: "Rappels et alertes" },
  { id: "abonnement", label: "Abonnement", icon: Crown, desc: "Distill Pro · Gérer" },
  { id: "confidentialite", label: "Confidentialité", icon: Shield, desc: "Données et usage" },
  { id: "securite", label: "Sécurité", icon: Shield, desc: "Compte et accès" },
];

const proFeatures = ["Générations illimitées", "Résumés et flashcards", "Support prioritaire"];

function SettingsRow({
  title,
  desc,
  children,
  border = true,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
  border?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-6 py-4 ${border ? "border-b border-border last:border-b-0" : ""}`}>
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{title}</div>
        {desc && <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Interrupteur générique pour les préférences qui n'ont pas encore de
 * modèle de données réel (voir note en tête de composant) — état local,
 * non persisté, comme le reste de cette phase de refonte. */
function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      role="switch"
      aria-checked={on}
      className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${on ? "bg-primary" : "bg-secondary"}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all duration-200 ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/** Bascule "Mode sombre" réelle — même mécanisme que ThemeToggle
 * (@/lib/useTheme), juste présentée comme une ligne de réglage plutôt
 * qu'un bouton icône. */
function DarkModeToggle() {
  const dark = useIsDarkMode();
  return (
    <button
      type="button"
      onClick={() => setDarkMode(!dark)}
      role="switch"
      aria-checked={dark}
      className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${dark ? "bg-primary" : "bg-secondary"}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all duration-200 ${dark ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/** Carte de consommation IA du mois en cours — lecture seule, aucune
 * possibilité d'achat/dépassement pour l'instant (voir @/lib/aiUsage). La
 * barre est divisée en deux segments proportionnels à la part de chaque
 * catégorie dans le total dépensé, sur une largeur totale plafonnée à 100%
 * du palier (rien n'empêche aujourd'hui le total réel de dépasser le
 * plafond affiché, purement informatif). */
function CreditUsageCard({ usage }: { usage: MonthlyUsageSummary }) {
  const { generationEur, chatEur, totalEur, capEur } = usage;
  const totalPercent = capEur > 0 ? Math.min(100, (totalEur / capEur) * 100) : 0;
  const generationShare = totalEur > 0 ? generationEur / totalEur : 0;
  const generationWidthPercent = totalPercent * generationShare;
  const chatWidthPercent = totalPercent - generationWidthPercent;
  const nearCap = totalEur >= capEur * 0.9;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium text-foreground">Consommation IA</div>
          <div className="text-xs text-muted-foreground">
            Ce mois-ci · palier Étudiant{IS_SUBSCRIBED_OVERRIDDEN && " · abonnement simulé"}
          </div>
        </div>
        <span className={`text-sm font-medium ${nearCap ? "text-amber-600" : "text-foreground"}`}>
          {totalEur.toFixed(2)}€ <span className="font-normal text-muted-foreground">/ {capEur.toFixed(2)}€</span>
        </span>
      </div>

      <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-accent transition-all duration-500" style={{ width: `${generationWidthPercent}%` }} />
        <div className="h-full bg-accent-dark transition-all duration-500" style={{ width: `${chatWidthPercent}%` }} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-accent" /> Résumés & QCM · {generationEur.toFixed(2)}€
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-accent-dark" /> Mode Explication · {chatEur.toFixed(2)}€
        </span>
      </div>
    </Card>
  );
}

interface SettingsFormProps {
  email: string;
  subscribed: boolean;
  memberSince: string;
  /** `null` pour les comptes non abonnés (le quota gratuit se mesure en
   * générations, pas en euros — voir @/lib/aiUsage). */
  usage: MonthlyUsageSummary | null;
}

/** Écran Paramètres — sur le modèle du Figma Make (Library.tsx → Settings),
 * adapté à ce que Distill fait réellement aujourd'hui : les sections sans
 * équivalent réel dans ce produit (Apple Pencil, langue, quota de stockage
 * cloud — Distill n'a ni multi-appareils ni sélecteur de langue) ont été
 * retirées plutôt que simulées avec des chiffres inventés. Compte et
 * Abonnement affichent les vraies données du profil ; Apparence > "Mode
 * sombre" pilote le vrai thème du site. Le reste (préférences IA,
 * notifications, confidentialité) reste en interrupteurs locaux non
 * persistés, comme le reste de cette phase de refonte. */
export function SettingsForm({ email, subscribed, memberSince, usage }: SettingsFormProps) {
  const [active, setActive] = useState<SettingsSection>("compte");
  const initial = (email[0] ?? "?").toUpperCase();

  return (
    <div className="mx-auto max-w-[1100px] animate-fade px-6 py-8 md:px-10 md:py-12">
      <h1 className="font-display text-4xl font-medium tracking-[-0.02em] text-foreground">Paramètres</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">Personnalise Distill à ton usage.</p>

      <div className="mt-8 flex gap-6 lg:gap-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="space-y-0.5">
            {sections.map((s) => {
              const on = active === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActive(s.id)}
                  className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition ${
                    on ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  {on && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />}
                  {s.icon ? <s.icon size={17} className={on ? "text-primary" : ""} /> : <AiOrb size={17} />}
                  {s.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="mb-4 w-full lg:hidden">
          <select
            value={active}
            onChange={(e) => setActive(e.target.value as SettingsSection)}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none"
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 flex-1">
          {active === "compte" && (
            <div className="space-y-4">
              <Card className="p-6">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl font-semibold text-primary-foreground">
                      {initial}
                    </div>
                    <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-secondary text-muted-foreground">
                      <Pen size={12} />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-2xl font-medium text-foreground">{email}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge className={subscribed ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}>
                        {subscribed ? "Distill Pro" : "Offre gratuite"}
                      </Badge>
                      {IS_SUBSCRIBED_OVERRIDDEN && <Badge className="bg-amber-100 text-amber-800">Abonnement simulé</Badge>}
                      <span className="text-xs text-muted-foreground">Membre depuis {memberSince}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Link href="/profile" className={buttonClasses("outline", "sm", "w-full rounded-xl")}>
                    Modifier le profil
                  </Link>
                  <form action="/auth/signout" method="post">
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="w-full rounded-xl text-red-500 hover:bg-red-500/10 hover:text-red-500"
                    >
                      <LogOut size={15} /> Déconnexion
                    </Button>
                  </form>
                </div>
              </Card>
            </div>
          )}

          {active === "apparence" && (
            <Card className="overflow-hidden">
              <div className="px-5">
                <SettingsRow title="Mode sombre" desc="Bascule entre le thème clair et sombre.">
                  <DarkModeToggle />
                </SettingsRow>
                <SettingsRow title="Taille du texte" desc="Interface un peu plus grande.">
                  <Toggle />
                </SettingsRow>
                <SettingsRow title="Réduire les animations" desc="Pour les personnes sensibles aux mouvements." border={false}>
                  <Toggle />
                </SettingsRow>
              </div>
            </Card>
          )}

          {active === "ia" && (
            <div className="space-y-4">
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <AiOrb size={40} />
                  <div>
                    <div className="font-medium text-foreground">IA Distill</div>
                    <div className="text-xs text-muted-foreground">Modèle Claude · Anthropic</div>
                  </div>
                </div>
              </Card>
              {usage && <CreditUsageCard usage={usage} />}
              <Card className="overflow-hidden">
                <div className="px-5">
                  <SettingsRow title="Suggestions automatiques" desc="Propose un résumé après chaque session de notes.">
                    <Toggle defaultOn />
                  </SettingsRow>
                  <SettingsRow title="Mémoire des préférences" desc="Mémorise ton format de résumé préféré." border={false}>
                    <Toggle />
                  </SettingsRow>
                </div>
              </Card>
            </div>
          )}

          {active === "notifications" && (
            <Card className="overflow-hidden">
              <div className="px-5">
                <SettingsRow title="Rappels de révision" desc="Te rappelle de réviser selon ton planning.">
                  <Toggle defaultOn />
                </SettingsRow>
                <SettingsRow title="Nouveautés Distill" desc="Nouvelles fonctionnalités et mises à jour.">
                  <Toggle defaultOn />
                </SettingsRow>
                <SettingsRow title="Abonnement" desc="Facturation et renouvellement." border={false}>
                  <Toggle defaultOn />
                </SettingsRow>
              </div>
            </Card>
          )}

          {active === "abonnement" && (
            <div className="space-y-4">
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                    <Crown size={26} />
                  </div>
                  <div>
                    <div className="font-display text-2xl font-medium text-foreground">
                      {subscribed ? "Distill Pro" : "Offre gratuite"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {subscribed ? "9,99 € / mois" : "3 générations gratuites"}
                    </div>
                  </div>
                </div>
                <Link href="/subscription" className={buttonClasses("primary", "sm", "mt-5 w-full rounded-xl sm:w-auto")}>
                  Gérer l&apos;abonnement
                </Link>
              </Card>
              <Card className="overflow-hidden">
                <div className="px-5">
                  {proFeatures.map((f, i) => (
                    <SettingsRow key={f} title={f} border={i < proFeatures.length - 1}>
                      <Check size={17} className="text-primary" />
                    </SettingsRow>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {active === "confidentialite" && (
            <Card className="overflow-hidden">
              <div className="px-5">
                <SettingsRow title="Analytics d'usage" desc="Aide à améliorer Distill (anonymisé).">
                  <Toggle defaultOn />
                </SettingsRow>
                <SettingsRow title="Amélioration de l'IA" desc="Tes notes améliorent le modèle (opt-in)." border={false}>
                  <Toggle />
                </SettingsRow>
              </div>
            </Card>
          )}

          {active === "securite" && (
            <div className="space-y-4">
              <Card className="overflow-hidden">
                <div className="px-5">
                  <SettingsRow title="Adresse e-mail" desc={email} border={false}>
                    <span className="text-xs text-muted-foreground">Gérée via la connexion</span>
                  </SettingsRow>
                </div>
              </Card>
              <Card className="overflow-hidden border-red-200 dark:border-red-900/40">
                <div className="px-5 py-1">
                  <div className="py-3 font-mono text-xs uppercase tracking-widest text-red-500">Zone de danger</div>
                  <SettingsRow title="Supprimer le compte" desc="Efface définitivement toutes tes données." border={false}>
                    <Button variant="ghost" size="sm" className="rounded-lg text-red-500 hover:bg-red-500/10 hover:text-red-500">
                      Supprimer
                    </Button>
                  </SettingsRow>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
