"use client";

import { useState } from "react";
import { Badge, Eyebrow } from "@/components/ui";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import type { Flashcard } from "@/lib/types";

/** Flashcards affichées une à la fois (deck), avec navigation précédent/
 * suivant et points de progression — plutôt qu'une liste empilée. Même
 * animation de retournement 3D que l'ancien FlashcardView (classes
 * .flip-card* partagées, définies dans globals.css). */
export function FlashcardDeck({ cards }: { cards: Flashcard[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const total = cards.length;
  const card = cards[index];

  function goTo(next: number) {
    setFlipped(false);
    setIndex(Math.max(0, Math.min(total - 1, next)));
  }

  function toggleFlip() {
    setFlipped((f) => !f);
  }

  return (
    <div className="flex animate-fade flex-col items-center gap-5">
      <div className="flex items-center gap-3">
        <Eyebrow>
          {index + 1} / {total}
        </Eyebrow>
        <div className="flex gap-1">
          {cards.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Carte ${i + 1}`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? "w-5 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/40"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flashcard-stack relative w-full max-w-sm">
        <div
          className={`flip-card h-52 w-full cursor-pointer ${flipped ? "is-flipped" : ""}`}
          role="button"
          tabIndex={0}
          aria-pressed={flipped}
          onClick={toggleFlip}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleFlip();
            }
          }}
        >
          <div className="flip-card-inner relative h-full w-full">
            {/* Face avant : la question */}
            <div className="flip-card-face absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-md)]">
              <Badge className="bg-secondary text-secondary-foreground">Question</Badge>
              <p className="font-display text-lg font-medium leading-snug text-foreground">{card.question}</p>
              <span className="text-xs text-muted-foreground">Cliquez pour révéler la réponse</span>
            </div>

            {/* Face arrière : la réponse */}
            <div
              className="flip-card-face flip-card-back absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl border p-6 text-center shadow-[var(--shadow-md)]"
              style={{
                borderColor: "color-mix(in srgb, var(--ai-1) 35%, var(--border))",
                background: "color-mix(in srgb, var(--ai-1) 6%, var(--card))",
              }}
            >
              <Badge className="bg-[color-mix(in_srgb,var(--ai-1)_14%,transparent)] text-[var(--ai-1)]">Réponse</Badge>
              <p className="text-[15px] leading-relaxed text-foreground">{card.answer}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          aria-label="Carte précédente"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-[var(--shadow-sm)] transition hover:shadow-[var(--shadow-md)] disabled:opacity-30"
        >
          <ChevronLeft size={17} />
        </button>
        <button
          type="button"
          onClick={toggleFlip}
          className="rounded-full border border-border bg-card px-5 py-2 text-[13px] font-medium shadow-[var(--shadow-sm)] transition hover:shadow-[var(--shadow-md)]"
        >
          {flipped ? "Masquer" : "Révéler"}
        </button>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={index === total - 1}
          aria-label="Carte suivante"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-[var(--shadow-sm)] transition hover:shadow-[var(--shadow-md)] disabled:opacity-30"
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
