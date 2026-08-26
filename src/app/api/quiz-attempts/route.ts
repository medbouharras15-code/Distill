import { NextResponse } from "next/server";
import { getUserAndProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { QuizAttemptsRequestBody, QuizAttemptsResponseBody, QuizThemeStat } from "@/lib/types";

/** Nombre minimum de réponses sur un même thème avant de l'inclure dans
 * l'analyse de lacunes — évite de juger un thème sur une seule question
 * ratée ou réussie par chance. */
const MIN_ATTEMPTS_PER_THEME = 3;

/** Marge de sécurité au-delà des 12 questions d'un QCM (voir
 * QUIZ_QUESTION_COUNT dans @/app/api/distill/quiz/route.ts) — défense en
 * profondeur contre un corps de requête anormalement volumineux. */
const MAX_ANSWERS_PER_REQUEST = 30;

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
 * à jour, cumulée sur tout l'historique de l'utilisateur (pas seulement ce
 * QCM) — appelée par QuizView une fois le score affiché. Écriture via le
 * client "service role" (RLS n'autorise que la lecture côté client, voir
 * schema.sql), lecture ensuite via le client de session (RLS filtre déjà
 * sur l'utilisateur courant) — même principe que les routes Team Brain. */
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

  if (!Array.isArray(body.answers) || body.answers.length === 0 || !body.answers.every(isValidAnswer)) {
    return NextResponse.json({ error: "Réponses de QCM invalides." }, { status: 400 });
  }
  const answers = body.answers.slice(0, MAX_ANSWERS_PER_REQUEST);

  const admin = createAdminClient();
  const { error: insertError } = await admin.from("quiz_answers").insert(
    answers.map((a) => ({
      user_id: auth.user.id,
      theme: a.theme,
      question_text: a.question,
      is_correct: a.isCorrect,
    })),
  );
  if (insertError) {
    console.error("Impossible d'enregistrer les réponses de QCM :", insertError);
    return NextResponse.json({ error: "Impossible d'enregistrer les réponses." }, { status: 500 });
  }

  const supabase = await createClient();
  const { data, error: readError } = await supabase
    .from("quiz_answers")
    .select("theme, is_correct")
    .eq("user_id", auth.user.id);

  if (readError || !data) {
    console.error("Impossible de lire l'historique de QCM :", readError);
    return NextResponse.json({ themes: [] } satisfies QuizAttemptsResponseBody);
  }

  const byTheme = new Map<string, { total: number; correct: number }>();
  for (const row of data as { theme: string; is_correct: boolean }[]) {
    const stat = byTheme.get(row.theme) ?? { total: 0, correct: 0 };
    stat.total += 1;
    if (row.is_correct) stat.correct += 1;
    byTheme.set(row.theme, stat);
  }

  const themes: QuizThemeStat[] = Array.from(byTheme.entries())
    .filter(([, s]) => s.total >= MIN_ATTEMPTS_PER_THEME)
    .map(([theme, s]) => ({
      theme,
      total: s.total,
      correct: s.correct,
      accuracy: Math.round((s.correct / s.total) * 100),
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  return NextResponse.json({ themes } satisfies QuizAttemptsResponseBody);
}
