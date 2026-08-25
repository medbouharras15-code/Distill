import { Badge, Eyebrow } from "@/components/ui";
import { Brain, Chat } from "@/lib/icons";
import { Reveal } from "./Reveal";

/** Échange fictif illustrant le Mode Explication — même mécanique que le
 * vrai composant (@/components/notes/ChatView) : une réponse courte, puis
 * une citation extraite du texte source plutôt qu'une réponse inventée. */
const exchange = {
  question: "Pourquoi le cycle de Calvin a-t-il besoin d'ATP ?",
  answer:
    "L'ATP fournit l'énergie nécessaire à la réduction du CO₂ fixé en glucides, une étape qui ne peut pas se produire spontanément.",
  citation: "…la réduction nécessite l'apport d'énergie sous forme d'ATP et de pouvoir réducteur (NADPH)…",
};

/** Section dédiée au Mode Explication (fonctionnalité réelle, voir
 * @/components/notes/ChatView) et, en dessous, un aperçu délibérément plus
 * discret de la détection de lacunes — évoquée mais jamais construite, donc
 * étiquetée "Bientôt disponible" (même formulation que les paliers non
 * encore configurés de PricingSection) plutôt que présentée comme utilisable
 * aujourd'hui. */
export function ExplanationSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 sm:px-8 sm:py-28">
      <Reveal className="mx-auto max-w-xl text-center">
        <Eyebrow>Mode Explication</Eyebrow>
        <h2 className="mt-4 font-display text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-4xl">
          Une explication, jamais une invention.
        </h2>
      </Reveal>

      <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        <Reveal delayMs={100}>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-light text-accent-dark">
            <Chat size={20} />
          </span>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Posez une question sur vos notes : Distill répond en citant directement le passage concerné dans votre
            source — jamais au-delà de ce que vous avez réellement écrit ou lu.
          </p>
          <Badge className="mt-5 border border-accent-light bg-accent-light/40 text-accent-dark">
            Inclus dès l&apos;abonnement Étudiant
          </Badge>
        </Reveal>

        <Reveal delayMs={200}>
          <div className="relative overflow-hidden rounded-[calc(var(--radius)+6px)] border border-border bg-card p-6 shadow-[var(--shadow-lg)] sm:p-7">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full opacity-30 blur-[70px]"
              style={{
                background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 25%, transparent) 0%, transparent 70%)",
              }}
            />
            <div className="relative flex flex-col gap-3">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-secondary px-4 py-2.5 text-[13.5px] text-foreground">
                {exchange.question}
              </div>
              <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-border bg-background-alt px-4 py-3 text-[13.5px] leading-relaxed text-foreground/90">
                {exchange.answer}
                <div className="mt-2.5 inline-flex items-start gap-1.5 rounded-full border border-accent-light bg-accent-light/40 px-2.5 py-1 text-[11.5px] leading-snug text-accent-dark">
                  <span className="font-display" aria-hidden="true">
                    &ldquo;
                  </span>
                  {exchange.citation}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Bientôt disponible — délibérément plus discret (pas de démo, pas de
          couleur d'accent) que le Mode Explication au-dessus, pour ne jamais
          laisser croire que c'est déjà utilisable. */}
      <Reveal delayMs={300} className="mx-auto mt-10 max-w-2xl">
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-border bg-background-alt/40 p-5 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
            <Brain size={18} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13.5px] font-medium text-foreground">Détection de lacunes</span>
              <Badge className="bg-secondary text-muted-foreground">Bientôt disponible</Badge>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              À partir de vos résultats de QCM, Distill identifiera automatiquement les notions à retravailler en
              priorité.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
