import { AiOrb } from "@/components/Brand";
import { Eyebrow } from "@/components/ui";
import { Cards, Upload } from "@/lib/icons";
import { Reveal } from "./Reveal";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Collez ou glissez",
    body: "Du texte, une photo de notes manuscrites ou un PDF de cours — Distill accepte vos notes telles qu'elles sont.",
  },
  {
    number: "02",
    icon: null,
    title: "L'IA distille",
    body: "En quelques secondes, l'essentiel est extrait et structuré : plus besoin de relire des pages entières.",
  },
  {
    number: "03",
    icon: Cards,
    title: "Révisez",
    body: "Un résumé clair et des flashcards prêtes à l'emploi, générés automatiquement à partir de votre contenu.",
  },
] as const;

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 sm:px-8 sm:py-28">
      <Reveal className="mx-auto max-w-xl text-center">
        <Eyebrow>Comment ça marche</Eyebrow>
        <h2 className="mt-4 font-display text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-4xl">
          De vos notes à la révision, en trois étapes.
        </h2>
      </Reveal>

      {/* Composition "étapes reliées" plutôt qu'une grille de cartes : les
          trois étapes sont reliées par un fin fil pointillé (uniquement à
          partir de sm, où elles s'alignent sur une ligne), avec le numéro
          de chaque étape en grand filigrane typographique derrière son
          repère plutôt que dans une bordure. */}
      <div className="relative mt-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[16%] top-7 hidden border-t border-dashed border-border sm:block"
        />

        <div className="grid gap-16 sm:grid-cols-3 sm:gap-10">
          {steps.map((step, i) => (
            <Reveal key={step.title} delayMs={i * 100} className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 select-none font-display text-7xl font-medium text-foreground/[0.07] sm:left-0 sm:translate-x-0 sm:text-8xl"
              >
                {step.number}
              </span>

              <div className="relative flex flex-col items-center text-center sm:items-start sm:text-left">
                <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background shadow-[var(--shadow-sm)]">
                  {step.icon ? (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-light text-accent-dark">
                      <step.icon size={18} />
                    </span>
                  ) : (
                    <AiOrb size={40} active />
                  )}
                </div>
                <h3 className="mt-5 font-display text-xl font-medium text-foreground">{step.title}</h3>
                <p className="mt-2.5 max-w-[22rem] text-[15px] leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
