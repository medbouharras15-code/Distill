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
