import type { Viewport } from "next";

/**
 * L'éditeur de notes implémente son propre zoom (pincement, molette,
 * boutons) sur la feuille. Sans ceci, un pincement à deux doigts peut
 * déclencher *en même temps* le zoom natif de la page (Safari) et notre
 * zoom JS sur le canvas — les deux systèmes se disputent alors les mêmes
 * coordonnées d'écran, ce qui produit un décalage important entre
 * l'endroit pincé et l'endroit où le zoom se recentre réellement. Scopé à
 * cette route uniquement : le reste du site garde le zoom natif normal.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function NotesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
