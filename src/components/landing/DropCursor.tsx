"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { DistillMark } from "@/components/Brand";

const QUERY = "(pointer: fine) and (hover: hover)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** S'abonne aux deux media queries qui décident si le curseur signature
 * doit s'afficher — même idiome que ThemeToggle (useSyncExternalStore) pour
 * gérer proprement l'écart attendu entre le rendu serveur et l'état client. */
function subscribe(callback: () => void) {
  const pointerMq = window.matchMedia(QUERY);
  const motionMq = window.matchMedia(REDUCED_MOTION_QUERY);
  pointerMq.addEventListener("change", callback);
  motionMq.addEventListener("change", callback);
  return () => {
    pointerMq.removeEventListener("change", callback);
    motionMq.removeEventListener("change", callback);
  };
}
function getEnabled() {
  return window.matchMedia(QUERY).matches && !window.matchMedia(REDUCED_MOTION_QUERY).matches;
}
function getServerEnabled() {
  return false;
}

/** Curseur signature en forme de goutte Distill, uniquement sur les
 * appareils à pointeur précis (souris/trackpad) — jamais sur tactile, et
 * jamais s'il court-circuite un contrôle réel : purement décoratif
 * (`pointer-events-none`), le vrai curseur système reste actif dessous. */
export function DropCursor() {
  const enabled = useSyncExternalStore(subscribe, getEnabled, getServerEnabled);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const pos = useRef({ x: -100, y: -100 });
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    function paint() {
      frame.current = null;
      const el = dotRef.current;
      if (el) el.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;
    }
    function onMove(e: PointerEvent) {
      pos.current = { x: e.clientX, y: e.clientY };
      if (frame.current === null) frame.current = requestAnimationFrame(paint);
    }

    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={dotRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[60] -translate-x-1/2 -translate-y-[85%] text-accent opacity-70 mix-blend-multiply transition-opacity duration-300 dark:opacity-80 dark:mix-blend-normal"
    >
      <DistillMark size={22} />
    </div>
  );
}
