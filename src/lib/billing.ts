import type { Profile } from "@/lib/types";

/** Nombre de générations gratuites offertes à vie, avant de devoir s'abonner. */
export const FREE_GENERATIONS_LIMIT = 3;

/** Statuts PayPal qui donnent un accès illimité à l'outil. */
const ACTIVE_STATUSES = new Set(["ACTIVE"]);

export function isSubscribed(profile: Pick<Profile, "subscription_status">): boolean {
  return ACTIVE_STATUSES.has(profile.subscription_status);
}

export function remainingFreeGenerations(
  profile: Pick<Profile, "generations_used" | "subscription_status">,
): number {
  if (isSubscribed(profile)) return Infinity;
  return Math.max(0, FREE_GENERATIONS_LIMIT - profile.generations_used);
}
