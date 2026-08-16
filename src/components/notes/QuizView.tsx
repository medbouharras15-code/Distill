"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/ui";
import { Check, Close } from "@/lib/icons";
import type { QuizQuestion } from "@/lib/types";

interface QuizViewProps {
  quiz: QuizQuestion[];
}

function isExactMatch(selected: Set<string>, correct: string[]): boolean {
  if (selected.size !== correct.length) return false;
  return correct.every((id) => selected.has(id));
}

/** QCM de révision (choix unique ou multiple selon la question, jamais
 * indiqué à l'avance — voir @/lib/types → QuizQuestion). Correction exacte :
 * une question à réponses multiples n'est comptée juste que si la sélection
 * correspond exactement à l'ensemble correct, ni oubli ni ajout — cohérent
 * avec un contexte d'examen. */
export function QuizView({ quiz }: QuizViewProps) {
  const [answers, setAnswers] = useState<Record<number, Set<string>>>({});
  const [submitted, setSubmitted] = useState(false);

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

  function retry() {
    setAnswers({});
    setSubmitted(false);
  }

  const answeredCount = Object.values(answers).filter((s) => s.size > 0).length;
  const score = submitted
    ? quiz.reduce((total, q, i) => total + (isExactMatch(answers[i] ?? new Set(), q.correctChoiceIds) ? 1 : 0), 0)
    : 0;

  return (
    <div className="animate-fade">
      {submitted && (
        <div className="mb-4 rounded-xl border border-accent-light bg-accent-light/30 p-4 text-center">
          <div className="font-display text-2xl font-medium text-accent-dark">
            {score} / {quiz.length}
          </div>
          <div className="text-xs text-accent-dark/80">Score final</div>
        </div>
      )}

      <div className="space-y-4">
        {quiz.map((q, i) => {
          const isMultiple = q.correctChoiceIds.length >= 2;
          const selected = answers[i] ?? new Set<string>();
          const correct = submitted && isExactMatch(selected, q.correctChoiceIds);

          return (
            <div
              key={i}
              className={`rounded-xl border p-4 transition ${
                submitted ? (correct ? "border-accent-light bg-accent-light/10" : "border-red-200 bg-red-50/40") : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug text-foreground">
                  {i + 1}. {q.question}
                </p>
                {submitted && (
                  <span className={`shrink-0 ${correct ? "text-accent-dark" : "text-red-600"}`}>
                    {correct ? <Check size={16} /> : <Close size={16} />}
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-1.5">
                {q.choices.map((choice) => {
                  const isChecked = selected.has(choice.id);
                  const isCorrectChoice = q.correctChoiceIds.includes(choice.id);
                  let optionClass = "border-border";
                  if (submitted) {
                    if (isCorrectChoice) optionClass = "border-accent-light bg-accent-light/40";
                    else if (isChecked) optionClass = "border-red-200 bg-red-50";
                  }
                  return (
                    <label
                      key={choice.id}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${optionClass} ${
                        submitted ? "cursor-default" : "hover:border-accent/50"
                      }`}
                    >
                      <input
                        type={isMultiple ? "checkbox" : "radio"}
                        name={`quiz-q${i}`}
                        checked={isChecked}
                        disabled={submitted}
                        onChange={() => toggleChoice(i, choice.id, isMultiple)}
                        className="shrink-0 accent-accent"
                      />
                      <span className="text-foreground/90">{choice.text}</span>
                    </label>
                  );
                })}
              </div>

              {submitted && q.explanation && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{q.explanation}</p>}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 mt-4 -mx-4 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        {submitted ? (
          <button type="button" onClick={retry} className={buttonClasses("outline", "sm", "w-full")}>
            ↺ Recommencer le QCM
          </button>
        ) : (
          <>
            <button type="button" onClick={() => setSubmitted(true)} className={buttonClasses("primary", "sm", "w-full")}>
              Valider mes réponses
            </button>
            {answeredCount < quiz.length && (
              <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                {quiz.length - answeredCount} question{quiz.length - answeredCount !== 1 ? "s" : ""} sans réponse — comptée
                {quiz.length - answeredCount !== 1 ? "s" : ""} comme incorrecte
                {quiz.length - answeredCount !== 1 ? "s" : ""}.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
