import type { Profile } from "@/lib/types";

const DEFAULT_FREE_GENERATIONS_LIMIT = 3;

/** Filet de sécurité indépendant de la variable d'environnement elle-même :
 * `VERCEL_ENV` est positionnée automatiquement par Vercel selon le
 * déploiement réel (jamais modifiable via le dashboard) — même si
 * NEXT_PUBLIC_FREE_GENERATIONS_LIMIT était par erreur aussi cochée sur
 * Production, la surcharge est ignorée dès que le code tourne réellement
 * en production. Toujours `false` en local (VERCEL_ENV n'existe pas hors
 * de Vercel), ce qui n'a pas d'incidence : la vraie limite s'applique par
 * défaut de toute façon en l'absence de la variable. */
const isProductionDeployment = process.env.VERCEL_ENV === "production";

const rawOverride = Number(process.env.NEXT_PUBLIC_FREE_GENERATIONS_LIMIT);
const hasValidOverride = !isProductionDeployment && Number.isFinite(rawOverride) && rawOverride > 0;

/** Nombre de générations gratuites offertes à vie, avant de devoir
 * s'abonner. Surchargeable via NEXT_PUBLIC_FREE_GENERATIONS_LIMIT — pour
 * tester sans être bloqué par "Limite atteinte", sans jamais toucher à ce
 * fichier ni à la vraie limite : définissez cette variable UNIQUEMENT sur
 * l'environnement Preview de Vercel (Project Settings → Environment
 * Variables → cocher seulement "Preview", jamais "Production"), à une
 * valeur élevée (ex. 1000). Absente (le cas par défaut, et toujours le cas
 * en local et en production), la vraie limite de 3 s'applique — rien à
 * modifier ni à se souvenir de revenir en arrière avant de merger. */
export const FREE_GENERATIONS_LIMIT = hasValidOverride ? rawOverride : DEFAULT_FREE_GENERATIONS_LIMIT;

/** Utilisé par l'interface pour signaler discrètement qu'une limite de
 * test est active, plutôt que de le laisser invisible. */
export const IS_FREE_LIMIT_OVERRIDDEN = hasValidOverride;

/** Statuts Lemon Squeezy qui donnent un accès illimité à l'outil. */
const ACTIVE_STATUSES = new Set(["active"]);

export function isSubscribed(profile: Pick<Profile, "subscription_status">): boolean {
  return ACTIVE_STATUSES.has(profile.subscription_status);
}

export function remainingFreeGenerations(
  profile: Pick<Profile, "generations_used" | "subscription_status">,
): number {
  if (isSubscribed(profile)) return Infinity;
  return Math.max(0, FREE_GENERATIONS_LIMIT - profile.generations_used);
}
