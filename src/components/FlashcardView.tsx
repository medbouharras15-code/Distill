"use client";

import { useState } from "react";
import type { Flashcard } from "@/lib/types";

export default function FlashcardView({
  card,
  index,
}: {
  card: Flashcard;
  index: number;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className={`flip-card h-56 cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 ${flipped ? "is-flipped" : ""}`}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      onClick={() => setFlipped((f) => !f)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setFlipped((f) => !f);
        }
      }}
    >
      <div className="flip-card-inner relative h-full w-full">
        {/* Face avant : la question */}
        <div className="flip-card-face absolute inset-0 flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
          <span className="text-xs font-medium uppercase tracking-wider text-accent-dark">
            Carte {index + 1} · Question
          </span>
          <p className="font-display text-lg leading-snug text-foreground">
            {card.question}
          </p>
          <span className="text-xs text-muted">
            Cliquez pour révéler la réponse
          </span>
        </div>

        {/* Face arrière : la réponse */}
        <div className="flip-card-face flip-card-back absolute inset-0 flex flex-col justify-between rounded-2xl border border-accent bg-accent-light/40 p-6 shadow-[var(--shadow-sm)]">
          <span className="text-xs font-medium uppercase tracking-wider text-accent-dark">
            Carte {index + 1} · Réponse
          </span>
          <p className="text-base leading-snug text-foreground">
            {card.answer}
          </p>
          <span className="text-xs text-muted">Cliquez pour revenir</span>
        </div>
      </div>
    </div>
  );
}
