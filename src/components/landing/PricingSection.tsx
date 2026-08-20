import Link from "next/link";
import { Badge, Card, Eyebrow, buttonClasses } from "@/components/ui";
import { Bolt, Check, Sparkle, Star } from "@/lib/icons";
import { Reveal } from "./Reveal";

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

// Mêmes 3 paliers que /subscription (voir @/components/SubscriptionForm,
// seule source de vérité pour le contenu des paliers — à garder synchronisé
// si les prix/fonctionnalités changent). Seule différence ici : un visiteur
// de la landing n'est jamais connecté, donc pas d'état "abonné" ni d'action
// subscribe/cancel — chaque palier renvoie simplement vers l'inscription
// (Essentiel/Intensif n'ont de toute façon pas encore de prix configuré
// chez le prestataire, "Bientôt disponible" comme sur /subscription).
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

export function PricingSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 sm:px-8 sm:py-28">
      <Reveal className="mx-auto max-w-xl text-center">
        <Eyebrow>Tarifs</Eyebrow>
        <h2 className="mt-4 font-display text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-4xl">
          Un palier pour chaque rythme de révision.
        </h2>
      </Reveal>

      <div className="mx-auto mt-14 grid max-w-5xl items-start gap-6 sm:grid-cols-3">
        {TIERS.map((tier, i) => {
          const Icon = tier.icon;
          return (
            <Reveal key={tier.id} delayMs={i * 100} className="relative">
              <div className={`relative ${tier.highlighted ? "sm:-translate-y-3 sm:scale-[1.02]" : ""}`}>
                {tier.highlighted && (
                  <div
                    className="absolute inset-x-4 -inset-y-2 -z-10 rounded-[calc(var(--radius)+14px)] bg-accent/25 blur-2xl"
                    aria-hidden="true"
                  />
                )}
                {tier.highlighted && (
                  <Badge className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 bg-accent text-[var(--primary-foreground)] shadow-[var(--shadow-md)]">
                    ✦ Recommandé
                  </Badge>
                )}

                <Card
                  className={`flex h-full flex-col p-7 ${
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

                  <div className="mt-4 font-display text-xl font-medium text-foreground">{tier.name}</div>
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
                    <Link href="/signup" className={buttonClasses("primary", "sm", "mt-6 w-full")}>
                      Créer un compte gratuit
                    </Link>
                  ) : (
                    <div className={buttonClasses("outline", "sm", "mt-6 w-full justify-center pointer-events-none opacity-60")}>
                      Bientôt disponible
                    </div>
                  )}
                </Card>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
