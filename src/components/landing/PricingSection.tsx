import Link from "next/link";
import { Card, Eyebrow, buttonClasses } from "@/components/ui";
import { FREE_GENERATIONS_LIMIT } from "@/lib/billing";
import { Check } from "@/lib/icons";
import { Reveal } from "./Reveal";

const freeFeatures = [`${FREE_GENERATIONS_LIMIT} générations gratuites`, "Résumés et flashcards", "Aucune carte bancaire requise"];
const proFeatures = ["Générations illimitées", "Résumés et flashcards", "Support prioritaire"];

export function PricingSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 sm:px-8 sm:py-28">
      <Reveal className="mx-auto max-w-xl text-center">
        <Eyebrow>Tarifs</Eyebrow>
        <h2 className="mt-4 font-display text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-4xl">
          Commencez gratuitement, sans engagement.
        </h2>
      </Reveal>

      <div className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-2">
        <Reveal>
          <Card className="relative h-full p-7 ring-2 ring-accent">
            <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-1 text-[11px] font-medium text-accent-foreground">
              Recommandé
            </span>
            <div className="text-sm font-medium text-muted-foreground">Gratuit</div>
            <div className="mt-2 font-display text-4xl font-medium text-foreground">0€</div>
            <ul className="mt-6 space-y-3">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-foreground/90">
                  <Check size={16} className="shrink-0 text-accent-dark" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/signup" className={buttonClasses("primary", "lg", "mt-7 w-full")}>
              Créer un compte gratuit
            </Link>
          </Card>
        </Reveal>

        <Reveal delayMs={100}>
          <Card className="h-full p-7">
            <div className="text-sm font-medium text-muted-foreground">Distill Pro</div>
            <div className="mt-2 font-display text-4xl font-medium text-foreground">
              9,99€<span className="text-base font-normal text-muted-foreground">/mois</span>
            </div>
            <ul className="mt-6 space-y-3">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-foreground/90">
                  <Check size={16} className="shrink-0 text-accent-dark" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/signup" className={buttonClasses("outline", "lg", "mt-7 w-full")}>
              Commencer
            </Link>
          </Card>
        </Reveal>
      </div>
    </section>
  );
}
