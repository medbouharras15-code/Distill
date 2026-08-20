/** Conversion euros ↔ jetons et barèmes affichés côté client — module
 * volontairement sans dépendance serveur (contrairement à @/lib/aiUsage,
 * qui l'utilise) pour rester importable depuis des composants "use client"
 * (AiPanel, ChatView, SettingsForm) sans embarquer de code serveur dans le
 * bundle navigateur. Le calcul réel en euros reste la source de vérité
 * interne (voir @/lib/aiUsage) — les jetons ne sont qu'une unité d'affichage
 * dérivée, jamais persistée telle quelle. */

/** Taux de conversion euros → jetons, dérivé du coût réel d'une génération
 * complète (résumé + QCM, ≈0,065€) fixée à 10 jetons — calcul détaillé
 * partagé et validé avec l'utilisateur avant implémentation. */
export const EUR_PER_JETON = 0.0065;

/** Coût typique en jetons de chaque action, pour l'estimation affichée
 * AVANT génération. Le débit réel après génération est calculé à partir du
 * coût réel de cet appel précis (voir jetonsForCostEur) — il peut différer
 * de cette estimation sur un document plus gros ou plus petit que la
 * moyenne (ex. un gros PDF qui bascule sur Sonnet coûtera davantage de
 * jetons réels que cette estimation typique). */
export const TYPICAL_JETONS = {
  resumeSeul: 8,
  resumeEtQcm: 10,
  messageChat: 6,
} as const;

/** Plafond mensuel par palier, en jetons — inclut une marge de sécurité
 * d'environ 20-24% par rapport à la conversion exacte des plafonds
 * nominaux en euros (Essentiel 2,50€, Étudiant 6€, Intensif 12€ — voir
 * @/components/SubscriptionForm), validée explicitement avec
 * l'utilisateur plutôt qu'une simple conversion arrondie. C'est cette
 * valeur, reconvertie en euros via EUR_PER_JETON, qui sert de vrai
 * plafond d'application dans @/lib/aiUsage — la marge est donc une vraie
 * protection financière, pas seulement un arrondi d'affichage. Seul
 * "etudiant" correspond à un palier réellement achetable aujourd'hui (voir
 * @/lib/billing, isSubscribed) — les deux autres valeurs sont prêtes pour
 * le jour où Essentiel/Intensif deviennent de vrais paliers achetables. */
export const TIER_CAPS_JETONS = {
  essentiel: 300,
  etudiant: 700,
  intensif: 1400,
} as const;

/** Convertit un coût réel en euros (cost_eur, voir @/lib/aiUsage) en
 * jetons pour l'affichage utilisateur. */
export function jetonsForCostEur(costEur: number): number {
  return Math.round(costEur / EUR_PER_JETON);
}
