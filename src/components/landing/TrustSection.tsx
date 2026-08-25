import { Eyebrow } from "@/components/ui";
import { Bolt, Lock, Sparkle } from "@/lib/icons";
import { Reveal } from "./Reveal";

const points = [
  {
    icon: Bolt,
    title: "Résultats en quelques secondes",
    body: "Pas de file d'attente ni de traitement en arrière-plan : le résumé et les flashcards apparaissent presque instantanément.",
  },
  {
    icon: Sparkle,
    title: "Propulsé par Claude, d'Anthropic",
    body: "Un modèle d'IA reconnu pour la qualité de sa compréhension de texte, appliqué à vos notes de cours.",
  },
  {
    icon: Lock,
    title: "Vos notes restent les vôtres",
    body: "Envoyées uniquement pour générer votre résumé — jamais partagées ni utilisées à d'autres fins.",
  },
];

export function TrustSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 sm:px-8 sm:py-24">
      <Reveal className="mx-auto max-w-xl text-center">
        <Eyebrow>Pourquoi Distill</Eyebrow>
        <h2 className="mt-4 font-display text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-4xl">
          Un outil sérieux, pas un gadget.
        </h2>
      </Reveal>

      {/* Colonnes aérées avec un fin séparateur vertical plutôt que des
          cartes bordées — distinct du traitement "cartes" de Tarifs et du
          traitement "étapes reliées" de Comment ça marche, pour ne pas
          répéter le même motif trois fois de suite sur la page. */}
      <div className="mt-14 grid gap-10 sm:grid-cols-3 sm:divide-x sm:divide-border">
        {points.map((point, i) => (
          <Reveal key={point.title} delayMs={i * 100} className="sm:px-8 sm:first:pl-0 sm:last:pr-0">
            <point.icon size={22} className="text-accent-dark" />
            <h3 className="mt-4 text-[15px] font-semibold text-foreground">{point.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
