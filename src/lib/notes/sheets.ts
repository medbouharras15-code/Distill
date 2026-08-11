import type { PaperSize, SheetType } from "./types";

export const SHEET_TYPES: { value: SheetType; label: string }[] = [
  { value: "plain", label: "Blanc" },
  { value: "lined-thin", label: "Ligné fin" },
  { value: "lined-wide", label: "Ligné large" },
  { value: "grid-small", label: "Quadrillé petit" },
  { value: "grid-large", label: "Quadrillé grand" },
  { value: "dot", label: "Pointillé" },
  { value: "cornell", label: "Cornell Note" },
  { value: "college-rule", label: "College Rule" },
  { value: "manuscript", label: "Manuscript" },
  { value: "columns-3", label: "Trois colonnes" },
  { value: "columns-2", label: "Deux colonnes" },
  { value: "table", label: "Tableau" },
  { value: "isometric", label: "Isométrique" },
  { value: "music", label: "Musique" },
  { value: "checklist", label: "Checklist" },
  { value: "storyboard", label: "Storyboard" },
];

export const PAPER_SIZES: { value: PaperSize; label: string; ratio: number }[] = [
  { value: "letter", label: "Letter", ratio: 8.5 / 11 },
  { value: "a4", label: "A4", ratio: 210 / 297 },
  { value: "a5", label: "A5", ratio: 148 / 210 },
];

/** Grand côté de la feuille en pixels logiques ; le petit côté est dérivé du
 * ratio du format choisi, pour garder les proportions réelles du papier. */
const LONG_EDGE = 1100;

export function getPageDimensions(paperSize: PaperSize): { width: number; height: number } {
  const paper = PAPER_SIZES.find((p) => p.value === paperSize) ?? PAPER_SIZES[0];
  return { width: Math.round(LONG_EDGE * paper.ratio), height: LONG_EDGE };
}

export const BACKGROUND_COLORS: { value: string; label: string }[] = [
  { value: "#ffffff", label: "Blanc" },
  { value: "#f7f0e2", label: "Crème" },
  { value: "#e7e5e0", label: "Gris clair" },
  { value: "#1c1b19", label: "Noir (mode nuit)" },
];
