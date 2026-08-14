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

/** Source de vérité partagée du mode sombre — utilisée par ThemeToggle et
 * par la bascule "Mode sombre" de l'écran Paramètres, pour qu'il n'existe
 * qu'un seul état réel plutôt que deux implémentations parallèles. */
export function useIsDarkMode() {
  return useSyncExternalStore(subscribeToThemeClass, getIsDark, getServerIsDark);
}

/** Applique le mode sombre (classe `dark` sur `<html>`) et persiste le
 * choix, déjà lu au chargement par le script anti-flash de `layout.tsx`. */
export function setDarkMode(next: boolean) {
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
  } catch {
    // Stockage indisponible (navigation privée…) — le choix ne persiste
    // simplement pas d'une session à l'autre, sans conséquence bloquante.
  }
}
