"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { ChevronRight } from "@/lib/icons";

export interface FaqItem {
  question: string;
  answer: string;
}

/** Accordéon FAQ partagé — même style que les listes à lignes divisées déjà
 * en place (voir SettingsForm.tsx, SettingsRow) : une seule Card, questions
 * séparées par une bordure, une seule ouverte à la fois. Réutilisé par la
 * FAQ de la landing (@/components/landing/FaqSection) et la FAQ interne
 * (@/app/(app)/faq), avec des contenus différents. */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <Card className="overflow-hidden">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.question} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-secondary/40"
            >
              <span className="text-[15px] font-medium text-foreground">{item.question}</span>
              <ChevronRight
                size={16}
                className={`shrink-0 text-muted-foreground transition-transform duration-300 ${open ? "rotate-90" : ""}`}
              />
            </button>
            {open && (
              <div className="animate-fade px-5 pb-4 text-[13.5px] leading-relaxed text-muted-foreground">
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}
