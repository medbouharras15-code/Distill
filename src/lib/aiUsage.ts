import type Anthropic from "@anthropic-ai/sdk";
import { FALLBACK_MODEL, MODEL } from "@/lib/distillServer";
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

/** Plafond mensuel de consommation IA par palier, en euros — pour l'instant
 * purement informatif (affiché dans Paramètres > IA Distill), aucune
 * application/blocage à ce stade. Seul "etudiant" correspond à une offre
 * réellement achetable aujourd'hui (voir @/components/SubscriptionForm) :
 * un utilisateur abonné (isSubscribed) est donc toujours considéré
 * "etudiant" ici, en attendant qu'Essentiel/Intensif deviennent de vrais
 * paliers achetables avec leur propre colonne sur profiles. */
export const TIER_CAPS_EUR = {
  essentiel: 2.5,
  etudiant: 6,
  intensif: 12,
} as const;

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
 * événements, comme pour getUserAndProfile. */
export async function getMonthlyUsageSummary(userId: string): Promise<MonthlyUsageSummary> {
  const fallback: MonthlyUsageSummary = { generationEur: 0, chatEur: 0, totalEur: 0, capEur: TIER_CAPS_EUR.etudiant };

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

  return { generationEur, chatEur, totalEur: generationEur + chatEur, capEur: TIER_CAPS_EUR.etudiant };
}
