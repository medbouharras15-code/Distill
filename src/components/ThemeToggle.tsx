"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "distill-theme";

/** S'abonne à la classe `dark` de `<html>` sans passer par un effet +
 * setState (source de désynchronisations serveur/client) : `useSyncExternalStore`
 * gère nativement l'écart attendu entre le rendu serveur (toujours "clair",
 * faute d'accès au DOM) et l'état réel côté client, déjà posé par le script
 * anti-flash de `layout.tsx` avant l'hydratation. */
function subscribeToThemeClass(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
function getIsDark() {
  return document.documentElement.classList.contains("dark");
}
function getServerIsDark() {
  return false;
}

/** Bouton de bascule clair/sombre — persiste le choix (localStorage) et
 * met à jour la classe `dark` sur `<html>`, déjà lue au chargement par le
 * script anti-flash injecté dans `layout.tsx`. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const dark = useSyncExternalStore(subscribeToThemeClass, getIsDark, getServerIsDark);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Stockage indisponible (navigation privée…) — le choix ne persiste
      // simplement pas d'une session à l'autre, sans conséquence bloquante.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"}
      title={dark ? "Mode clair" : "Mode sombre"}
      className={`flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-background-alt hover:text-foreground ${className}`}
    >
      {dark ? (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" />
        </svg>
      ) : (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
        </svg>
      )}
    </button>
  );
}
