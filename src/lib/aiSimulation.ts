import type { ChatResponseBody, DistillResult, QuizQuestion } from "@/lib/types";

/** Filet de sécurité indépendant de la variable d'environnement elle-même —
 * même principe que IS_FREE_LIMIT_OVERRIDDEN (voir billing.ts) : VERCEL_ENV
 * est positionnée automatiquement par Vercel selon le déploiement réel
 * (jamais modifiable via le dashboard) — même si
 * NEXT_PUBLIC_SIMULATE_AI_RESPONSES était par erreur aussi cochée sur
 * Production, la surcharge est ignorée dès que le code tourne réellement en
 * production. Toujours `false` en local (VERCEL_ENV n'existe pas hors de
 * Vercel), ce qui n'a pas d'incidence : les vrais appels API s'appliquent par
 * défaut de toute façon en l'absence de la variable. */
const isProductionDeployment = process.env.VERCEL_ENV === "production";

/** Mode simulation : remplace les vrais appels à l'API Anthropic par des
 * réponses factices instantanées sur /api/distill, /api/distill/quiz et
 * /api/distill/chat — pour tester l'interface (onglets, navigation,
 * affichage) sans consommer de crédit API. Définir
 * NEXT_PUBLIC_SIMULATE_AI_RESPONSES=true UNIQUEMENT sur l'environnement
 * Preview de Vercel (Project Settings → Environment Variables → cocher
 * seulement "Preview", jamais "Production"). Absente (le cas par défaut, et
 * toujours le cas en local et en production), les vrais appels API restent
 * inchangés. Importable côté client (AiPanel) comme côté serveur (les trois
 * routes) : NEXT_PUBLIC_* est inliné dans les deux bundles par Next.js. */
export const IS_SIMULATION_ENABLED =
  !isProductionDeployment && process.env.NEXT_PUBLIC_SIMULATE_AI_RESPONSES === "true";

/** Délai artificiel avant de renvoyer une réponse simulée, pour laisser les
 * états de chargement (GeneratingState, indicateur "Réflexion…" du chat) le
 * temps de s'afficher et d'être vérifiés visuellement — une réponse
 * instantanée les ferait disparaître avant même d'être visibles. */
const SIMULATED_DELAY_MS = 1200;

async function simulateLatency(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_DELAY_MS));
}

export async function buildFakeDistillResult(): Promise<DistillResult> {
  await simulateLatency();
  return {
    summary: `# Résumé simulé (mode simulation)

Ceci est un résumé factice — aucun appel à l'API Anthropic n'a été effectué. Il sert uniquement à tester l'affichage (titres, sections, texte en gras).

## Première section (simulation)
**Point clé simulé** : ce texte n'a aucun rapport avec vos notes réelles.

## Deuxième section (simulation)
**Autre point clé simulé** : utilisé uniquement pour vérifier le rendu visuel du résumé.`,
    flashcards: Array.from({ length: 9 }, (_, i) => ({
      question: `Question factice n°${i + 1} (simulation) ?`,
      answer: `Réponse factice n°${i + 1} — contenu de test, aucune vraie analyse IA.`,
    })),
  };
}

// Thèmes factices variés (mode simulation) : quelques questions par thème
// pour pouvoir tester l'analyse de lacunes (regroupement + seuil minimum)
// sans appel réel à Claude.
const FAKE_QUIZ_THEMES = ["Thème simulé A", "Thème simulé B", "Thème simulé C"];

export async function buildFakeQuizResult(questionCount: number): Promise<QuizQuestion[]> {
  await simulateLatency();
  return Array.from({ length: questionCount }, (_, i) => {
    const isMultiple = i % 3 === 0;
    return {
      question: `Question factice n°${i + 1} (simulation) ?`,
      choices: ["a", "b", "c", "d"].map((id) => ({
        id,
        text: `Proposition ${id.toUpperCase()} — question ${i + 1} (simulation)`,
      })),
      correctChoiceIds: isMultiple ? ["a", "b"] : ["a"],
      explanation: `Explication factice pour la question ${i + 1} — mode simulation, aucune vraie analyse.`,
      theme: FAKE_QUIZ_THEMES[i % FAKE_QUIZ_THEMES.length],
    };
  });
}

export async function buildFakeChatResponse(question: string): Promise<ChatResponseBody> {
  await simulateLatency();
  return {
    answer: `Réponse simulée à votre question « ${question} » — mode simulation actif, aucun appel réel à l'API Anthropic n'a été effectué.`,
    citations: [{ quote: "Extrait factice cité à titre de démonstration du mode simulation." }],
  };
}
