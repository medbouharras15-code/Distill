import { FaqAccordion } from "@/components/FaqAccordion";
import { Eyebrow } from "@/components/ui";
import { Reveal } from "./Reveal";

// FAQ publique, marketing — questions générales pour convaincre un visiteur
// avant inscription. La FAQ interne (plus technique, orientée confiance
// pour les utilisateurs déjà inscrits) est une page séparée, voir
// @/app/(app)/faq.
const items = [
  {
    question: "Comment fonctionne Distill ?",
    answer:
      "Colle du texte, ajoute une photo de tes notes ou un PDF de cours : Distill génère en quelques secondes un résumé structuré, des flashcards et un QCM, grâce à l'IA Claude (Anthropic).",
  },
  {
    question: "Quels formats sont acceptés ?",
    answer:
      "Texte collé directement, photo (notes manuscrites ou imprimées) et PDF jusqu'à 15 Mo — combinables entre eux pour une même distillation.",
  },
  {
    question: "Quelle est la différence entre les paliers Essentiel, Étudiant et Intensif ?",
    answer:
      "Essentiel donne accès au résumé, aux flashcards et au QCM. Étudiant ajoute le Mode Explication, un chat qui répond à tes questions à partir de tes notes. Intensif ajoute en plus une priorité de traitement et un accès anticipé aux nouvelles fonctionnalités.",
  },
  {
    question: "Y a-t-il un essai gratuit ?",
    answer: "Oui — 3 générations offertes à vie, sans carte bancaire, pour tester Distill sur tes propres notes.",
  },
  {
    question: "Le Mode Explication, c'est quoi exactement ?",
    answer:
      "Un chat qui répond à tes questions uniquement à partir des notes que tu as distillées — jamais à partir de connaissances générales externes. Inclus à partir du palier Étudiant.",
  },
  {
    question: "Puis-je annuler mon abonnement à tout moment ?",
    answer: "Oui, en un clic depuis la page Abonnement ou Paramètres — sans engagement ni préavis.",
  },
  {
    question: "Distill fonctionne-t-il pour toutes les matières et tous les niveaux ?",
    answer: "Oui — Distill s'adapte au contenu que tu lui donnes, du lycée aux études supérieures, toutes matières confondues.",
  },
  {
    question: "Mes documents sont-ils en sécurité ?",
    answer:
      "Tes PDF et photos sont traités le temps de la génération puis supprimés — Distill ne conserve pas de copie permanente de tes documents sources.",
  },
];

export function FaqSection() {
  return (
    <section className="relative mx-auto max-w-3xl px-6 py-20 sm:px-8 sm:py-28">
      {/* Halo discret, cohérent avec le reste de la page (même technique
          color-mix que Hero/Aperçu produit/Mode Explication) — volontaire-
          ment plus subtil ici, section de contenu dense plutôt que moment
          de mise en avant. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full opacity-25 blur-[100px]"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 20%, transparent) 0%, transparent 70%)" }}
      />

      <Reveal className="relative text-center">
        <Eyebrow>Questions fréquentes</Eyebrow>
        <h2 className="mt-4 font-display text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-4xl">
          Tout ce qu&apos;il faut savoir.
        </h2>
      </Reveal>

      <Reveal delayMs={100} className="relative mt-12">
        <FaqAccordion items={items} />
      </Reveal>
    </section>
  );
}
