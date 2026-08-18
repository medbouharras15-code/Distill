// Mode comparaison de modèles — Preview/dev uniquement, jamais en
// production (même garde-fou que FREE_GENERATIONS_LIMIT dans billing.ts :
// VERCEL_ENV est positionnée automatiquement par Vercel selon le
// déploiement réel, jamais modifiable via le dashboard). Exécute un
// second appel, sur le même contenu et le même prompt, à un modèle moins
// cher (Haiku) en plus de l'appel normal — pour comparer manuellement la
// qualité avant de basculer /api/distill et /api/distill/quiz dessus.
const isProductionDeployment = process.env.VERCEL_ENV === "production";

/** Activé uniquement si NEXT_PUBLIC_MODEL_COMPARISON_ENABLED=1 est défini
 * sur l'environnement Preview de Vercel (Project Settings → Environment
 * Variables → cocher seulement "Preview", jamais "Production"). Absent
 * (le cas par défaut, et toujours le cas en local et en production), le
 * mode comparaison n'existe simplement pas : un seul appel comme avant. */
export const IS_MODEL_COMPARISON_ENABLED =
  !isProductionDeployment && process.env.NEXT_PUBLIC_MODEL_COMPARISON_ENABLED === "1";

/** Modèle comparé au modèle actuel (voir MODEL dans distillServer.ts). */
export const COMPARISON_MODEL = "claude-haiku-4-5";

/** Nom affiché dans l'interface pour le modèle de comparaison. */
export const COMPARISON_MODEL_LABEL = "Claude Haiku 4.5";

/** Traduit une erreur de l'appel de comparaison en message clair pour
 * l'utilisateur — cas particulier pour la limite de pages PDF, qui dépend
 * de la fenêtre de contexte du modèle : 600 pages pour un contexte 1M
 * (comme le modèle principal), mais seulement 100 pages pour un contexte
 * 200K (Claude Haiku 4.5). Sans ce cas particulier, l'utilisateur ne voit
 * que le message brut de l'API Anthropic ("A maximum of 100 PDF pages may
 * be provided."), qui n'explique pas pourquoi la comparaison échoue alors
 * que la génération principale, elle, a réussi sur le même document. */
export function describeComparisonError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/pdf pages/i.test(message)) {
    return `${COMPARISON_MODEL_LABEL} a un contexte plus court (200K) que le modèle principal (1M) : il ne peut analyser que 100 pages de PDF maximum, contre 600 pour le modèle actuel. Ce document dépasse cette limite — la comparaison n'est possible que sur des PDF plus courts, du texte collé ou une photo.`;
  }
  return message || "Le modèle de comparaison a échoué.";
}
