import { redirect } from "next/navigation";
import { FaqAccordion } from "@/components/FaqAccordion";
import { getUserAndProfile } from "@/lib/auth";

// FAQ interne, plus technique et orientée confiance (traitement des notes,
// stockage, Mode Explication, jetons, suppression de compte) — pour les
// utilisateurs déjà inscrits. La FAQ publique (marketing, sur la landing)
// est une section séparée, voir @/components/landing/FaqSection.
const items = [
  {
    question: "Comment mes notes sont-elles utilisées par l'IA ?",
    answer:
      "Le texte, la photo ou le PDF que tu fournis est envoyé à Claude (Anthropic) uniquement pour générer ta réponse — résumé, flashcards, QCM ou réponse en Mode Explication — jamais à d'autres fins, jamais partagé avec un tiers.",
  },
  {
    question: "Mes documents sont-ils stockés, et combien de temps ?",
    answer:
      "Les PDF sont téléversés temporairement le temps du traitement puis supprimés automatiquement juste après — aucune copie permanente n'est conservée sur nos serveurs. Les photos sont envoyées directement à l'IA sans jamais être stockées sous forme de fichier.",
  },
  {
    question: "Le Mode Explication répond-il uniquement à partir de mes notes ?",
    answer:
      "Oui — le chat est explicitement configuré pour répondre exclusivement à partir du contenu que tu as distillé dans la session, jamais à partir de connaissances générales externes. S'il ne trouve pas la réponse dans tes notes, il te le dit plutôt que d'inventer.",
  },
  {
    question: "Que se passe-t-il si j'atteins mon plafond de jetons ?",
    answer:
      "Tes générations sont bloquées avec un message clair jusqu'au mois suivant, où ton plafond se réinitialise automatiquement — aucun montant supplémentaire n'est facturé sans ton accord.",
  },
  {
    question: "Mes réponses de chat sont-elles conservées ?",
    answer:
      "Non — l'historique du Mode Explication n'est jamais enregistré sur nos serveurs. Il vit uniquement dans ton navigateur le temps de la session et disparaît à la fermeture du panneau.",
  },
  {
    question: "Puis-je supprimer mes données ou mon compte ?",
    answer:
      "La suppression de compte en un clic est en cours de mise en place. En attendant, écris-nous à med.bouharras.15@gmail.com et nous supprimons tes données manuellement.",
  },
  {
    question: "Quel modèle d'IA est utilisé, mes données servent-elles à l'entraîner ?",
    answer:
      "Distill utilise les modèles Claude (Haiku et Sonnet, selon la taille du contenu) via l'API commerciale d'Anthropic. Par défaut, Anthropic n'utilise pas les données envoyées via son API commerciale pour entraîner ses modèles — une garantie contractuelle distincte de leurs offres grand public (Claude.ai Free/Pro/Max).",
  },
  {
    question: "Comment est calculée ma consommation de jetons ?",
    answer:
      "Chaque résumé, QCM ou message de chat consomme un nombre de jetons calculé selon la taille réelle de ton document — une estimation s'affiche avant de lancer une génération, le débit exact apparaît ensuite dans ta consommation du mois (Paramètres > IA Distill).",
  },
];

export default async function FaqPage() {
  const auth = await getUserAndProfile();
  if (!auth) {
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-[720px] animate-fade px-6 py-8 md:px-10 md:py-12">
      <h1 className="font-display text-4xl font-medium tracking-[-0.02em] text-foreground">Questions fréquentes</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Comment Distill traite tes notes, tes données, et ta consommation IA.
      </p>

      <div className="mt-8">
        <FaqAccordion items={items} />
      </div>
    </div>
  );
}
