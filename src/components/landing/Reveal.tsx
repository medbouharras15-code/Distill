"use client";

import type { ReactNode } from "react";
import { useReveal } from "./useScrollMotion";

/** Révélation au scroll pour une section entière — voir useReveal. Toujours
 * visible sans JavaScript (repli `<noscript>` dans LandingGate) et pour les
 * utilisateurs qui préfèrent moins de mouvement (globals.css). */
export function Reveal({
  children,
  delayMs = 0,
  className = "",
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const { ref, state } = useReveal();

  return (
    <div ref={ref} data-reveal={state} style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined} className={className}>
      {children}
    </div>
  );
}
