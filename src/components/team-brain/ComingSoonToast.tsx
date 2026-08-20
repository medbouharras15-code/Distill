"use client";

import { useRef, useState } from "react";

/** Petit mécanisme de retour visuel partagé pour les actions décoratives de
 * la démo Team Brain (Nouveau projet, Ajouter un document, Inviter…) — sans
 * lui, cliquer sur ces boutons ne provoque aucune réaction visuelle, ce qui
 * peut sembler être un bug plutôt qu'une limite assumée de la démo (design
 * uniquement, aucune de ces actions n'a de vraie logique). Auto-disparaît
 * après 2,5 s ; un nouveau clic relance simplement le délai. */
export function useComingSoonToast() {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function trigger() {
    setVisible(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(false), 2500);
  }

  return { visible, trigger };
}

export function ComingSoonToast({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="pointer-events-auto animate-fade rounded-full border border-border bg-foreground px-4 py-2.5 text-[13px] font-medium text-background shadow-[var(--shadow-lg)]">
        Fonctionnalité à venir — pas encore disponible dans cette démo
      </div>
    </div>
  );
}
