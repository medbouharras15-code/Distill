import type { PaperSize, SheetType } from "@/lib/notes/types";

/** Données d'exemple pour les écrans applicatifs (Dashboard, Mes carnets,
 * Favoris, Historique…) refondus sur le modèle du Figma Make "NoteFlash".
 * Pas encore branchées à Supabase — voir le README de la Phase 3 : elles
 * seront remplacées par de vraies requêtes une fois la navigation globale
 * validée visuellement. `sheetType`/`paperSize` reprennent volontairement
 * les types réels de l'éditeur (@/lib/notes/types) pour que les aperçus
 * utilisent le vrai moteur de rendu (SheetPreview) plutôt qu'une maquette. */

export interface MockNotebook {
  id: string;
  title: string;
  subject: string;
  color: string;
  sheetType: SheetType;
  paperSize: PaperSize;
  pages: number;
  updated: string;
  favorite: boolean;
}

export const mockNotebooks: MockNotebook[] = [
  { id: "n1", title: "Biologie cellulaire", subject: "SVT", color: "#0f7a63", sheetType: "cornell", paperSize: "a4", pages: 42, updated: "il y a 2 h", favorite: true },
  { id: "n2", title: "Analyse — Intégrales", subject: "Mathématiques", color: "#3b6ee0", sheetType: "grid-small", paperSize: "letter", pages: 28, updated: "hier", favorite: true },
  { id: "n3", title: "Révolution française", subject: "Histoire", color: "#c2632a", sheetType: "lined-thin", paperSize: "a4", pages: 61, updated: "il y a 3 j", favorite: false },
  { id: "n4", title: "Chimie organique", subject: "Chimie", color: "#8a3fd1", sheetType: "isometric", paperSize: "a4", pages: 34, updated: "il y a 5 j", favorite: false },
  { id: "n5", title: "Anglais — Essays", subject: "Langues", color: "#c9436f", sheetType: "college-rule", paperSize: "letter", pages: 19, updated: "la semaine dernière", favorite: true },
  { id: "n6", title: "Physique — Mécanique", subject: "Physique", color: "#1f9c8c", sheetType: "grid-large", paperSize: "a4", pages: 47, updated: "il y a 2 sem.", favorite: false },
];

export interface MockHistoryItem {
  id: string;
  title: string;
  notebook: string;
  action: string;
  time: string;
}

export const mockHistoryItems: MockHistoryItem[] = [
  { id: "h1", title: "Photosynthèse — cycle de Calvin", notebook: "Biologie cellulaire", action: "Résumé généré", time: "il y a 42 min" },
  { id: "h2", title: "Intégration par parties", notebook: "Analyse — Intégrales", action: "Flashcards créées", time: "il y a 2 h" },
  { id: "h3", title: "Les causes de 1789", notebook: "Révolution française", action: "Page modifiée", time: "hier" },
  { id: "h4", title: "Réactions SN1 / SN2", notebook: "Chimie organique", action: "Fiche de révision", time: "hier" },
  { id: "h5", title: "Present perfect vs preterit", notebook: "Anglais — Essays", action: "Écriture convertie en texte", time: "il y a 2 j" },
];
