import { NextResponse } from "next/server";
import { getUserAndProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { QuizAttemptsRequestBody, QuizAttemptsResponseBody, QuizOverallStat, QuizThemeStat } from "@/lib/types";

/** Nombre minimum de réponses sur un même thème avant de l'inclure dans
 * l'analyse de lacunes — évite de juger un thème sur une seule question
 * ratée ou réussie par chance. */
const MIN_ATTEMPTS_PER_THEME = 3;

/** Marge de sécurité au-delà des 12 questions d'un QCM (voir
 * QUIZ_QUESTION_COUNT dans @/app/api/distill/quiz/route.ts) — défense en
 * profondeur contre un corps de requête anormalement volumineux. */
const MAX_ANSWERS_PER_REQUEST = 30;

/** Clé de regroupement insensible à l'ordre des mots, aux accents, à la
 * casse et à la ponctuation — deux appels séparés à /api/distill/quiz ne
 * renvoient pas toujours le même intitulé de thème mot pour mot pour la
 * même notion (ex. "Régulation salivaire parasympathique" vs "Régulation
 * parasympathique salivaire", observé en pratique), même si le prompt
 * demande la cohérence *au sein* d'un même QCM. Un simple regroupement par
 * égalité stricte (voir l'ancien code) laissait ces variantes bloquées
 * chacune à 1 occurrence, sans jamais atteindre MIN_ATTEMPTS_PER_THEME.
 * Recalculée à chaque lecture : les réponses déjà enregistrées avec des
 * variantes différentes se regroupent automatiquement, sans migration. */
function normalizeThemeKey(theme: string): string {
  return theme
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

/** Libellé affiché pour un groupe de thèmes normalisés : la variante brute
 * la plus fréquente parmi celles rencontrées (déterministe en cas
 * d'égalité, grâce à l'ordre d'itération stable de Map). */
function mostCommonVariant(variantCounts: Map<string, number>): string {
  let best = "";
  let bestCount = -1;
  for (const [variant, count] of variantCounts) {
    if (count > bestCount) {
      best = variant;
      bestCount = count;
    }
  }
  return best;
}

function isValidAnswer(value: unknown): value is { theme: string; question: string; isCorrect: boolean } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.theme === "string" &&
    v.theme.trim().length > 0 &&
    typeof v.question === "string" &&
    v.question.trim().length > 0 &&
    typeof v.isCorrect === "boolean"
  );
}

/** Enregistre les réponses d'un QCM corrigé et renvoie l'analyse de lacunes
 * à jour, scopée au document distillé à l'origine de ce QCM (voir
 * distillationId, jamais mélangée avec d'autres PDF) — appelée par
 * QuizView une fois le score affiché. Écriture via le client "service
 * role" (RLS n'autorise que la lecture côté client, voir schema.sql),
 * lecture ensuite via le client de session (RLS filtre déjà sur
 * l'utilisateur courant) — même principe que les routes Team Brain. */
export async function POST(request: Request) {
  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  let body: QuizAttemptsRequestBody;
  try {
    body = (await request.json()) as QuizAttemptsRequestBody;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (typeof body.distillationId !== "string" || body.distillationId.trim().length === 0) {
    return NextResponse.json({ error: "Distillation invalide." }, { status: 400 });
  }
  if (!Array.isArray(body.answers) || body.answers.length === 0 || !body.answers.every(isValidAnswer)) {
    return NextResponse.json({ error: "Réponses de QCM invalides." }, { status: 400 });
  }
  const answers = body.answers.slice(0, MAX_ANSWERS_PER_REQUEST);

  const admin = createAdminClient();
  const { error: insertError } = await admin.from("quiz_answers").insert(
    answers.map((a) => ({
      user_id: auth.user.id,
      distillation_id: body.distillationId,
      theme: a.theme,
      question_text: a.question,
      is_correct: a.isCorrect,
    })),
  );
  if (insertError) {
    console.error("Impossible d'enregistrer les réponses de QCM :", insertError);
    return NextResponse.json({ error: "Impossible d'enregistrer les réponses." }, { status: 500 });
  }

  // Diagnostic : jusqu'ici rien n'était loggé en cas de succès, rendant
  // impossible de vérifier si un enregistrement a bien eu lieu (et avec
  // quels thèmes) sans accès direct à la base — voir aussi le log
  // "répartition par thème" ci-dessous, qui montre les thèmes encore sous
  // le seuil MIN_ATTEMPTS_PER_THEME (donc absents de la réponse renvoyée
  // au client).
  // Le detail par réponse (pas seulement les thèmes) est indispensable ici :
  // c'est le seul moyen de vérifier, via les logs serveur, que isCorrect
  // reçu correspond bien à ce que l'utilisateur voit affiché côté client. Un
  // aperçu de la question (80 caractères) est inclus pour permettre de
  // reconnaître la question visuellement dans ce seul log, sans avoir besoin
  // d'accéder à la console du navigateur (impossible sur certains appareils,
  // ex. iPad) — le thème seul ne suffit pas si plusieurs questions d'un même
  // QCM partagent le même thème.
  console.log("[quiz-attempts] Réponses enregistrées :", {
    userId: auth.user.id,
    distillationId: body.distillationId,
    count: answers.length,
    answers: answers.map((a) => ({ theme: a.theme, isCorrect: a.isCorrect, question: a.question.slice(0, 80) })),
  });

  const supabase = await createClient();
  const { data, error: readError } = await supabase
    .from("quiz_answers")
    .select("theme, is_correct, created_at")
    .eq("user_id", auth.user.id)
    .eq("distillation_id", body.distillationId);

  if (readError || !data) {
    console.error("Impossible de lire l'historique de QCM :", readError);
    return NextResponse.json({ themes: [], overall: null } satisfies QuizAttemptsResponseBody);
  }

  // Regroupe par clé normalisée (voir normalizeThemeKey) plutôt que par
  // égalité stricte du texte — sinon deux variantes du même thème (ordre
  // des mots, accents, casse…) restent comptées séparément et n'atteignent
  // jamais MIN_ATTEMPTS_PER_THEME chacune de leur côté. lastAnsweredAt sert
  // uniquement de critère de départage ci-dessous (voir le tri), jamais
  // renvoyé au client — sans lui, deux thèmes à égalité de précision
  // (fréquent avec de petits échantillons : 0 %, 33 %, 50 %…) gardaient
  // l'ordre d'insertion, qui favorise arbitrairement les thèmes les plus
  // anciens au détriment de sujets tout aussi fragiles mais testés plus
  // récemment.
  const byTheme = new Map<
    string,
    { total: number; correct: number; lastAnsweredAt: string; variantCounts: Map<string, number> }
  >();
  for (const row of data as { theme: string; is_correct: boolean; created_at: string }[]) {
    const key = normalizeThemeKey(row.theme);
    const stat = byTheme.get(key) ?? {
      total: 0,
      correct: 0,
      lastAnsweredAt: row.created_at,
      variantCounts: new Map<string, number>(),
    };
    stat.total += 1;
    if (row.is_correct) stat.correct += 1;
    if (row.created_at > stat.lastAnsweredAt) stat.lastAnsweredAt = row.created_at;
    stat.variantCounts.set(row.theme, (stat.variantCounts.get(row.theme) ?? 0) + 1);
    byTheme.set(key, stat);
  }

  // Montre les variantes brutes regroupées sous chaque thème normalisé —
  // utile pour repérer si le modèle dérive encore trop (beaucoup de
  // variantes différentes pour un même sujet) malgré ce regroupement.
  console.log("[quiz-attempts] Répartition par thème normalisé (avant seuil de 3) :", {
    userId: auth.user.id,
    distillationId: body.distillationId,
    breakdown: Array.from(byTheme.values()).map((s) => ({
      theme: mostCommonVariant(s.variantCounts),
      total: s.total,
      correct: s.correct,
      variants: Array.from(s.variantCounts.keys()),
    })),
  });

  const themes: QuizThemeStat[] = Array.from(byTheme.values())
    .filter((s) => s.total >= MIN_ATTEMPTS_PER_THEME)
    // Taux de réussite croissant (le plus fragile en premier, sur le ratio
    // brut plutôt que l'accuracy arrondie affichée ensuite) ; à égalité, le
    // thème testé le plus récemment passe devant — voir le commentaire sur
    // lastAnsweredAt ci-dessus.
    .sort((a, b) => a.correct / a.total - b.correct / b.total || b.lastAnsweredAt.localeCompare(a.lastAnsweredAt))
    .map((s) => ({
      theme: mostCommonVariant(s.variantCounts),
      total: s.total,
      correct: s.correct,
      accuracy: Math.round((s.correct / s.total) * 100),
    }));

  // Contexte affiché à côté de la carte "Points faibles" : sans lui, une
  // poignée de thèmes réellement et systématiquement ratés peut occuper tout
  // le classement alors que le reste des réponses sur ce même document
  // (souvent la majorité) est bien maîtrisé — donnant à tort une impression
  // d'échec généralisé plutôt que quelques lacunes précises. Porte sur
  // TOUTES les réponses de ce document, pas seulement les thèmes qui
  // atteignent le seuil.
  const overallTotal = data.length;
  const overallCorrect = (data as { is_correct: boolean }[]).filter((row) => row.is_correct).length;
  const overall: QuizOverallStat | null =
    overallTotal > 0
      ? { total: overallTotal, correct: overallCorrect, accuracy: Math.round((overallCorrect / overallTotal) * 100) }
      : null;

  return NextResponse.json({ themes, overall } satisfies QuizAttemptsResponseBody);
}
