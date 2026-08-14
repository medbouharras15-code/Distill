import { AiOrb } from "@/components/Brand";
import { Card, Eyebrow } from "@/components/ui";
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

      <div className="mt-14 grid gap-6 sm:grid-cols-3">
        {steps.map((step, i) => (
          <Reveal key={step.title} delayMs={i * 100}>
            <Card className="relative h-full overflow-hidden p-7">
              <span className="font-mono text-[11px] text-muted-foreground/60">{step.number}</span>
              <div className="mt-4 flex h-11 w-11 items-center justify-center">
                {step.icon ? (
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-light text-accent-dark">
                    <step.icon size={20} />
                  </span>
                ) : (
                  <AiOrb size={44} active />
                )}
              </div>
              <h3 className="mt-5 font-display text-lg font-medium text-foreground">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{step.body}</p>
            </Card>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
