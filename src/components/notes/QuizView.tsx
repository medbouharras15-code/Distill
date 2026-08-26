"use client";

import { useState } from "react";
import { Card, buttonClasses } from "@/components/ui";
import { Check, Close, Sparkle } from "@/lib/icons";
import { DistillMark } from "@/components/Brand";
import type { QuizAttemptsResponseBody, QuizQuestion, QuizThemeStat } from "@/lib/types";

interface QuizViewProps {
  quiz: QuizQuestion[];
  /** Demande un nouveau QCM sur le même contenu (AiPanel régénère via
   * /api/distill/quiz puis remonte ce composant avec les nouvelles
   * questions — voir la prop `key` côté AiPanel). Remplace l'ancien
   * "recommencer" qui rejouait les mêmes 12 questions déjà corrigées, ce
   * qui n'a pas de sens une fois les réponses connues. */
  onRegenerate: () => void;
}

/** Score à partir duquel le moment signature (goutte) se joue à la
 * correction — seuil purement décoratif, n'affecte jamais le calcul du
 * score lui-même (isExactMatch, ci-dessous, inchangé). */
const PERFECT_SCORE_THRESHOLD = 0.75;

function isExactMatch(selected: Set<string>, correct: string[]): boolean {
  if (selected.size !== correct.length) return false;
  return correct.every((id) => selected.has(id));
}

function choiceLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/** QCM de révision (choix unique ou multiple selon la question, jamais
 * indiqué à l'avance — voir @/lib/types → QuizQuestion). Correction exacte :
 * une question à réponses multiples n'est comptée juste que si la sélection
 * correspond exactement à l'ensemble correct, ni oubli ni ajout — cohérent
 * avec un contexte d'examen. */
export function QuizView({ quiz, onRegenerate }: QuizViewProps) {
  const [answers, setAnswers] = useState<Record<number, Set<string>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showDroplet, setShowDroplet] = useState(false);
  /** `null` tant que l'enregistrement des réponses n'a pas encore répondu
   * (ou a échoué) — la carte "Points faibles" ci-dessous reste alors
   * simplement absente, jamais bloquante pour la correction du QCM. */
  const [themeStats, setThemeStats] = useState<QuizThemeStat[] | null>(null);

  function toggleChoice(questionIndex: number, choiceId: string, isMultiple: boolean) {
    if (submitted) return;
    setAnswers((prev) => {
      const next = { ...prev };
      const current = new Set(prev[questionIndex] ?? []);
      if (isMultiple) {
        if (current.has(choiceId)) current.delete(choiceId);
        else current.add(choiceId);
      } else {
        current.clear();
        current.add(choiceId);
      }
      next[questionIndex] = current;
      return next;
    });
  }

  function submit() {
    setSubmitted(true);
    const finalScore = quiz.reduce(
      (total, q, i) => total + (isExactMatch(answers[i] ?? new Set(), q.correctChoiceIds) ? 1 : 0),
      0,
    );
    if (quiz.length > 0 && finalScore / quiz.length >= PERFECT_SCORE_THRESHOLD) {
      window.setTimeout(() => setShowDroplet(true), 500);
      window.setTimeout(() => setShowDroplet(false), 3000);
    }

    // Détection de lacunes : envoi en arrière-plan, jamais bloquant pour
    // l'affichage de la correction — un échec réseau laisse simplement
    // themeStats à null (carte "Points faibles" absente).
    const payload = {
      answers: quiz.map((q, i) => ({
        theme: q.theme,
        question: q.question,
        isCorrect: isExactMatch(answers[i] ?? new Set(), q.correctChoiceIds),
      })),
    };
    // Diagnostic : à comparer avec ce qui s'affiche en vert/rouge juste en
    // dessous (correction détaillée) et avec le log serveur
    // "[quiz-attempts] Réponses enregistrées" — permet de savoir si un
    // éventuel écart vient du calcul côté client ou de la suite de la
    // chaîne (réseau, serveur, lecture).
    console.log("[QuizView] Envoi à /api/quiz-attempts :", payload.answers);
    fetch("/api/quiz-attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => (res.ok ? (res.json() as Promise<QuizAttemptsResponseBody>) : null))
      .then((data) => {
        if (data) setThemeStats(data.themes);
      })
      .catch(() => {
        // Silencieux, voir commentaire ci-dessus.
      });
  }

  const answeredCount = Object.values(answers).filter((s) => s.size > 0).length;
  const score = submitted
    ? quiz.reduce((total, q, i) => total + (isExactMatch(answers[i] ?? new Set(), q.correctChoiceIds) ? 1 : 0), 0)
    : 0;
  const pct = submitted && quiz.length > 0 ? Math.round((score / quiz.length) * 100) : 0;
  const scoreMessage =
    pct === 100
      ? "Parfait — tout est acquis."
      : pct >= 75
        ? "Très bon travail, continue ainsi."
        : pct >= 50
          ? "Bonne base — relis les points manqués."
          : "À retravailler, les explications vont t'aider.";

  if (!submitted) {
    return (
      <div className="animate-fade">
        <div className="space-y-4">
          {quiz.map((q, i) => {
            const isMultiple = q.correctChoiceIds.length >= 2;
            const selected = answers[i] ?? new Set<string>();

            return (
              <Card key={i} className="paper-grain overflow-hidden p-0">
                <div className="border-b border-border px-5 py-3.5">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {i + 1}/{quiz.length}
                    </span>
                    <p className="text-[14px] font-medium leading-snug text-foreground">{q.question}</p>
                  </div>
                </div>

                <div className="space-y-1.5 p-3.5">
                  {q.choices.map((choice, ci) => {
                    const isChecked = selected.has(choice.id);
                    return (
                      <label
                        key={choice.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left text-[13.5px] leading-snug transition ${
                          isChecked
                            ? "border-primary bg-accent-light/40 font-medium shadow-[0_0_0_1px_var(--primary)]"
                            : "border-border bg-background/60 hover:border-primary/40 hover:bg-accent-light/20"
                        }`}
                      >
                        <input
                          type={isMultiple ? "checkbox" : "radio"}
                          name={`quiz-q${i}`}
                          checked={isChecked}
                          onChange={() => toggleChoice(i, choice.id, isMultiple)}
                          className="sr-only"
                        />
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold transition ${
                            isChecked ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
                          }`}
                        >
                          {isChecked ? <Check size={11} /> : choiceLetter(ci)}
                        </span>
                        <span className="text-foreground/90">{choice.text}</span>
                      </label>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="sticky bottom-0 mt-4 -mx-4 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
          <button type="button" onClick={submit} className={buttonClasses("primary", "lg", "w-full rounded-2xl")}>
            Valider mes réponses
          </button>
          {answeredCount < quiz.length && (
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
              {quiz.length - answeredCount} question{quiz.length - answeredCount !== 1 ? "s" : ""} sans réponse — comptée
              {quiz.length - answeredCount !== 1 ? "s" : ""} comme incorrecte
              {quiz.length - answeredCount !== 1 ? "s" : ""}.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade space-y-5">
      {/* Carte de score */}
      <Card className="paper-grain relative overflow-hidden p-7 text-center animate-score-rise">
        {showDroplet && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center pt-4" aria-hidden="true">
            <div
              className="animate-droplet-descend text-primary"
              style={{ filter: "drop-shadow(0 0 12px color-mix(in srgb, var(--ai-2) 60%, transparent))" }}
            >
              <DistillMark size={40} />
            </div>
          </div>
        )}

        {pct >= 75 && (
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--ai-2) 30%, transparent) 0%, transparent 65%)",
            }}
          />
        )}

        <div className="relative">
          <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Score final</div>
          <div
            className="mt-3 font-display text-6xl font-medium tabular-nums tracking-tight"
            style={{ color: pct >= 75 ? "var(--ai-1)" : "var(--foreground)" }}
          >
            {score}
            <span className="text-3xl text-muted-foreground">/{quiz.length}</span>
          </div>
          <div className="mt-2 font-display text-lg font-medium text-foreground">{scoreMessage}</div>

          <div className="mx-auto mt-5 h-2 max-w-xs overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${pct}%`,
                background: pct >= 75 ? "linear-gradient(90deg, var(--ai-1), var(--ai-2))" : "var(--primary)",
                transitionDelay: "200ms",
              }}
            />
          </div>
          <div className="mt-2 font-mono text-[12px] text-muted-foreground">{pct}%</div>
        </div>
      </Card>

      {/* Détection de lacunes — cumulée sur tout l'historique de QCM de
          l'utilisateur (pas seulement celui-ci), voir /api/quiz-attempts.
          Absente tant que themeStats est null (requête en cours ou échouée),
          jamais bloquante pour le reste de la correction. */}
      {themeStats && themeStats.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground">
            <Sparkle size={16} className="text-primary" /> Points faibles à réviser en priorité
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            D&apos;après l&apos;ensemble de tes QCM, du thème le plus fragile au plus solide.
          </p>
          <div className="mt-4 space-y-3">
            {themeStats.slice(0, 5).map((t) => (
              <div key={t.theme}>
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="truncate font-medium text-foreground">{t.theme}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {t.accuracy}% · {t.correct}/{t.total}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${t.accuracy}%`,
                      background:
                        t.accuracy < 50 ? "#ef4444" : t.accuracy < 75 ? "#f59e0b" : "var(--ai-1)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {themeStats && themeStats.length === 0 && (
        <Card className="flex items-center gap-3 p-5">
          <Sparkle size={16} className="shrink-0 text-muted-foreground" />
          <p className="text-[13px] text-muted-foreground">
            Pas encore assez de données : une même notion doit revenir dans au moins 3 questions (dans ce QCM ou les
            suivants) pour être analysée de façon fiable. Continue à générer des QCM sur tes différents cours pour
            débloquer ton analyse de points faibles.
          </p>
        </Card>
      )}

      {/* Correction détaillée */}
      {quiz.map((q, i) => {
        const selected = answers[i] ?? new Set<string>();
        const correct = isExactMatch(selected, q.correctChoiceIds);

        return (
          <Card key={i} className="paper-grain overflow-hidden p-0">
            <div
              className={`flex items-center gap-3 border-b px-5 py-3.5 ${
                correct
                  ? "border-[color-mix(in_srgb,var(--ai-1)_20%,var(--border))] bg-[color-mix(in_srgb,var(--ai-1)_5%,transparent)]"
                  : "border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${
                  correct ? "bg-[var(--ai-1)]" : "bg-red-500"
                }`}
              >
                {correct ? <Check size={13} /> : <Close size={13} />}
              </span>
              <p className="text-[14px] font-medium leading-snug text-foreground">{q.question}</p>
            </div>

            <div className="space-y-1.5 p-3.5">
              {q.choices.map((choice, ci) => {
                const isCorrectChoice = q.correctChoiceIds.includes(choice.id);
                const isUserChoice = selected.has(choice.id);
                return (
                  <div
                    key={choice.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-[13.5px] leading-snug ${
                      isCorrectChoice
                        ? "border-[color-mix(in_srgb,var(--ai-1)_35%,transparent)] bg-[color-mix(in_srgb,var(--ai-1)_8%,transparent)] font-medium"
                        : isUserChoice
                          ? "border-red-300 bg-red-50 text-red-700 line-through opacity-70 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
                          : "border-border bg-background/40 text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                        isCorrectChoice
                          ? "border-[var(--ai-1)] bg-[var(--ai-1)] text-white"
                          : isUserChoice
                            ? "border-red-500 bg-red-500 text-white"
                            : "border-border"
                      }`}
                    >
                      {isCorrectChoice ? <Check size={11} /> : isUserChoice ? <Close size={11} /> : choiceLetter(ci)}
                    </span>
                    {choice.text}
                  </div>
                );
              })}
            </div>

            {q.explanation && (
              <div className="border-t border-border bg-secondary/40 px-5 py-3.5">
                <div className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
                  <Sparkle size={14} className="mt-0.5 shrink-0 text-primary" />
                  <span className="leading-relaxed">{q.explanation}</span>
                </div>
              </div>
            )}
          </Card>
        );
      })}

      <button type="button" onClick={onRegenerate} className={buttonClasses("outline", "lg", "w-full rounded-2xl")}>
        Nouveau QCM sur ce contenu
      </button>
    </div>
  );
}
