"use client";

import { useEffect, useRef, useState } from "react";

/** Révèle un bloc (fondu + léger déplacement) quand il entre dans le
 * viewport — piloté via `[data-reveal]` dans globals.css. `eager` révèle
 * immédiatement sans attendre le scroll (pour le hero, toujours visible au
 * chargement). Se déconnecte après la première apparition : un aller simple,
 * pas une animation qui rejoue à chaque scroll. */
export function useReveal(eager = false) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    if (eager || visible) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, visible]);

  return { ref, state: visible ? ("visible" as const) : ("hidden" as const) };
}

/** Décalage vertical léger lié au scroll (parallax en couches) : un
 * multiplicateur `speed` proche de 0 pour l'arrière-plan (bouge à peine,
 * donne une impression de profondeur), plus élevé pour le premier plan.
 * Un seul listener de scroll passif + rAF, désactivé pour les utilisateurs
 * qui préfèrent moins de mouvement. */
export function useParallax(speed: number) {
  const [offset, setOffset] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || speed === 0) return;

    function update() {
      frame.current = null;
      setOffset(window.scrollY * speed);
    }
    function onScroll() {
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [speed]);

  return offset;
}
