import type Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { SubscriptionTier } from "@/lib/billing";
import { FALLBACK_MODEL, MODEL } from "@/lib/distillServer";
import { EUR_PER_JETON, jetonsForCostEur, TIER_CAPS_JETONS } from "@/lib/jetons";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Taux de change USD → EUR utilisé pour convertir les tarifs Anthropic
 * (facturés en dollars) en euros pour l'affichage dans Paramètres > IA
 * Distill. Approximatif et fixe — une vraie API de change en temps réel
 * serait disproportionnée pour ce simple affichage informatif. À ajuster
 * manuellement si l'écart devient significatif. */
const USD_TO_EUR_RATE = 0.92;

/** Tarifs Anthropic en dollars par million de tokens (entrée/sortie),
 * vérifiés au moment de la mise en place du repli automatique Haiku→Sonnet
 * (voir distillServer.ts) — à tenir à jour si les tarifs changent. */
const MODEL_PRICING_USD: Record<string, { input: number; output: number }> = {
  [MODEL]: { input: 1, output: 5 },
  [FALLBACK_MODEL]: { input: 3, output: 15 },
};

/** Plafond réel appliqué à l'abonné selon son palier (voir usageCapResponse
 * plus bas), dérivé du plafond en jetons validé avec l'utilisateur (voir
 * TIER_CAPS_JETONS dans @/lib/jetons pour le détail de la marge de
 * sécurité intégrée) plutôt que d'un plafond nominal en euros séparé — la
 * marge est ainsi une vraie protection financière, pas seulement un
 * arrondi d'affichage. */
function tierCapEur(tier: SubscriptionTier): number {
  return TIER_CAPS_JETONS[tier] * EUR_PER_JETON;
}

export type UsageCategory = "generation" | "chat";

/** Calcule le coût en euros d'un appel Claude à partir de son usage et du
 * modèle qui a réellement répondu (peut différer du modèle par défaut en
 * cas de repli, voir callClaudeWithFallback — response.model reflète
 * toujours le modèle réel). Même pondération de cache que celle déjà
 * vérifiée en pratique (écriture ×1,25, lecture ×0,1, TTL 5 min). */
export function computeCostEur(usage: Anthropic.Usage, model: string): number {
  const pricing = MODEL_PRICING_USD[model];
  if (!pricing) return 0;

  const cacheCreation = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;

  const costUsd =
    (usage.input_tokens * pricing.input +
      cacheCreation * pricing.input * 1.25 +
      cacheRead * pricing.input * 0.1 +
      usage.output_tokens * pricing.output) /
    1_000_000;

  return costUsd * USD_TO_EUR_RATE;
}

/** Enregistre un appel Claude réel réussi pour le suivi de consommation
 * (Paramètres > IA Distill). N'est appelée que sur le chemin réel des 3
 * routes /api/distill, /api/distill/quiz et /api/distill/chat — jamais
 * atteinte en mode simulation (voir @/lib/aiSimulation), qui court-circuite
 * l'appel avant même d'obtenir un vrai `response.usage`. Écrit via le client
 * "service role" : comme pour generations_used sur profiles, les
 * utilisateurs n'ont pas le droit d'écrire ces lignes eux-mêmes (RLS,
 * lecture seule côté client). Ne fait jamais échouer la requête si
 * l'écriture échoue — c'est un indicateur informatif, pas une donnée
 * bloquante pour la génération. */
export async function logAiUsageEvent({
  userId,
  category,
  model,
  usage,
}: {
  userId: string;
  category: UsageCategory;
  model: string;
  usage: Anthropic.Usage;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("ai_usage_events").insert({
      user_id: userId,
      category,
      model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
      cost_eur: computeCostEur(usage, model),
    });
  } catch (error) {
    console.error("Impossible d'enregistrer l'événement de consommation IA :", error);
  }
}

export interface MonthlyUsageSummary {
  generationEur: number;
  chatEur: number;
  totalEur: number;
  capEur: number;
}

/** Résumé de consommation du mois en cours pour Paramètres > IA Distill —
 * lecture seule, aucune application de plafond à ce stade. Utilise le
 * client authentifié (protégé par RLS, voir schema.sql) plutôt que le
 * client "service role" : un utilisateur ne peut lire que ses propres
 * événements, comme pour getUserAndProfile. `tier` détermine le plafond
 * applicable (voir tierCapEur) — appelant responsable de ne passer ici que
 * le palier d'un utilisateur réellement abonné (voir getTier). */
export async function getMonthlyUsageSummary(userId: string, tier: SubscriptionTier): Promise<MonthlyUsageSummary> {
  const capEur = tierCapEur(tier);
  const fallback: MonthlyUsageSummary = { generationEur: 0, chatEur: 0, totalEur: 0, capEur };

  const supabase = await createClient();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("ai_usage_events")
    .select("category, cost_eur")
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  if (error || !data) {
    console.error("Impossible de récupérer la consommation IA du mois :", error);
    return fallback;
  }

  let generationEur = 0;
  let chatEur = 0;
  for (const row of data as { category: UsageCategory; cost_eur: number }[]) {
    if (row.category === "chat") {
      chatEur += Number(row.cost_eur);
    } else {
      generationEur += Number(row.cost_eur);
    }
  }

  return { generationEur, chatEur, totalEur: generationEur + chatEur, capEur };
}

export interface MonthlyUsageSummaryJetons {
  generationJetons: number;
  chatJetons: number;
  totalJetons: number;
  capJetons: number;
}

/** Version en jetons de getMonthlyUsageSummary, pour l'affichage côté
 * client (carte "Consommation IA" de Paramètres > IA Distill) — le calcul
 * en euros ci-dessus reste la source de vérité interne, jamais montrée au
 * client. capJetons vient directement de TIER_CAPS_JETONS plutôt que d'une
 * conversion de capEur, pour éviter tout écart d'arrondi avec la valeur
 * ronde déjà validée. */
export async function getMonthlyUsageSummaryJetons(
  userId: string,
  tier: SubscriptionTier,
): Promise<MonthlyUsageSummaryJetons> {
  const summary = await getMonthlyUsageSummary(userId, tier);
  return {
    generationJetons: jetonsForCostEur(summary.generationEur),
    chatJetons: jetonsForCostEur(summary.chatEur),
    totalJetons: jetonsForCostEur(summary.totalEur),
    capJetons: TIER_CAPS_JETONS[tier],
  };
}

/** Vérifie si l'abonné a déjà atteint son plafond mensuel de consommation
 * IA — à appeler juste avant tout appel Claude réel (résumé, QCM, chat),
 * jamais en mode simulation (voir @/lib/aiSimulation, qui court-circuite
 * l'appel avant même d'atteindre ce point dans chaque route). Ne concerne
 * que les abonnés : le quota des comptes gratuits reste géré séparément
 * par generations_used/FREE_GENERATIONS_LIMIT, inchangé. Renvoie une
 * réponse HTTP prête à l'emploi si le plafond est atteint, sinon `null`
 * pour laisser l'appelant poursuivre normalement.
 *
 * Échoue "ouvert" en cas d'erreur de lecture Supabase : getMonthlyUsageSummary
 * renvoie déjà un total à 0 dans ce cas (voir son fallback ci-dessus), donc
 * cette fonction ne bloque jamais à cause d'un problème d'infrastructure
 * sans rapport — décision explicitement validée plutôt que de bloquer tous
 * les abonnés à cause d'une panne technique. */
export async function usageCapResponse(userId: string, tier: SubscriptionTier): Promise<NextResponse | null> {
  const summary = await getMonthlyUsageSummary(userId, tier);
  if (summary.totalEur < summary.capEur) return null;

  return NextResponse.json(
    {
      error: `Tu as atteint ton plafond de ${TIER_CAPS_JETONS[tier]} jetons pour ce mois-ci. Il sera réinitialisé au début du mois prochain.`,
      usageCapReached: true,
    },
    { status: 403 },
  );
}
