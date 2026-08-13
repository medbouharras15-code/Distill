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
  /** Regroupement affiché sur l'écran Historique (@/app/(app)/history) — le
   * Dashboard, lui, affiche simplement les items les plus récents sans
   * grouper, d'où un champ optionnel côté consommateur. */
  group: "Aujourd'hui" | "Hier" | "Il y a 2 jours";
}

export const mockHistoryItems: MockHistoryItem[] = [
  { id: "h1", title: "Photosynthèse — cycle de Calvin", notebook: "Biologie cellulaire", action: "Résumé généré", time: "il y a 42 min", group: "Aujourd'hui" },
  { id: "h2", title: "Intégration par parties", notebook: "Analyse — Intégrales", action: "Flashcards créées", time: "il y a 2 h", group: "Aujourd'hui" },
  { id: "h3", title: "Les causes de 1789", notebook: "Révolution française", action: "Page modifiée", time: "hier, 14:32", group: "Hier" },
  { id: "h4", title: "Réactions SN1 / SN2", notebook: "Chimie organique", action: "Fiche de révision", time: "hier, 11:08", group: "Hier" },
  { id: "h5", title: "Present perfect vs preterit", notebook: "Anglais — Essays", action: "Écriture convertie en texte", time: "il y a 2 j", group: "Il y a 2 jours" },
];

/** Actions considérées "IA" pour la mise en forme (badge dégradé, point de
 * timeline coloré) sur l'écran Historique. */
export const AI_HISTORY_ACTIONS = ["Résumé généré", "Flashcards créées", "Fiche de révision", "Écriture convertie en texte"];

export interface MockFavoritePage {
  id: string;
  title: string;
  notebook: string;
  page: string;
  sheetType: SheetType;
  updated: string;
}

export const mockFavoritePages: MockFavoritePage[] = [
  { id: "fp1", title: "Cycle de Calvin — schéma complet", notebook: "Biologie cellulaire", page: "Page 14", sheetType: "cornell", updated: "il y a 2 h" },
  { id: "fp2", title: "Intégration par parties — démonstration", notebook: "Analyse — Intégrales", page: "Page 6", sheetType: "grid-small", updated: "hier" },
  { id: "fp3", title: "The conditional tense — rules", notebook: "Anglais — Essays", page: "Page 9", sheetType: "college-rule", updated: "la semaine dernière" },
];

export interface MockSearchResult {
  id: string;
  type: "note" | "notebook" | "ai";
  excerpt: string;
  notebook: string;
  page: string;
  sheetType: SheetType;
}

export const mockSearchResults: MockSearchResult[] = [
  { id: "s1", type: "note", excerpt: "Le cycle de Calvin fixe le CO₂ grâce à la RuBisCO…", notebook: "Biologie cellulaire", page: "Page 14", sheetType: "cornell" },
  { id: "s2", type: "note", excerpt: "La primitive d'une fonction continue existe toujours…", notebook: "Analyse — Intégrales", page: "Page 6", sheetType: "grid-small" },
  { id: "s3", type: "note", excerpt: "Convocation des États généraux le 5 mai 1789…", notebook: "Révolution française", page: "Page 22", sheetType: "lined-thin" },
  { id: "s4", type: "notebook", excerpt: "Biologie cellulaire", notebook: "SVT · 42 pages", page: "", sheetType: "cornell" },
  { id: "s5", type: "ai", excerpt: "Résumé — Photosynthèse · cycle de Calvin", notebook: "Biologie cellulaire", page: "Généré il y a 42 min", sheetType: "plain" },
];

export const searchSuggestions = ["RuBisCO", "Intégrales", "1789", "SN1 / SN2", "Calvin"];

/** Regroupement thématique des 16 types de feuille réels de l'éditeur
 * (@/lib/notes/sheets → SHEET_TYPES), pour l'écran "Nouveau carnet" —
 * même esprit que le classement du Figma Make, appliqué aux vrais types
 * plutôt qu'à une liste de papiers fictive. */
export const SHEET_TYPE_GROUPS: { label: string; types: SheetType[] }[] = [
  { label: "Essentiels", types: ["plain", "lined-thin", "lined-wide", "dot"] },
  { label: "Grilles", types: ["grid-small", "grid-large", "isometric"] },
  { label: "Étude", types: ["cornell", "college-rule", "checklist"] },
  { label: "Mise en page", types: ["columns-2", "columns-3", "table"] },
  { label: "Spécial", types: ["manuscript", "music", "storyboard"] },
];

export const NOTEBOOK_COLORS = ["#0f7a63", "#3b6ee0", "#c2632a", "#8a3fd1", "#c9436f", "#1f9c8c"];
