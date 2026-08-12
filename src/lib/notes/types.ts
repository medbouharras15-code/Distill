export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export type PenType = "fineliner" | "ballpoint" | "brush";

export type InkTool = "pen" | "highlighter";

export interface Stroke {
  id: string;
  tool: InkTool;
  /** Utilisé uniquement quand tool === "pen". */
  penType?: PenType;
  color: string;
  /** Épaisseur de base en pixels logiques (avant modulation par la pression). */
  size: number;
  points: StrokePoint[];
}

export type PaperSize = "letter" | "a4" | "a5";

export type SheetType =
  | "plain"
  | "lined-thin"
  | "lined-wide"
  | "grid-small"
  | "grid-large"
  | "dot"
  | "cornell"
  | "college-rule"
  | "manuscript"
  | "columns-3"
  | "columns-2"
  | "table"
  | "isometric"
  | "music"
  | "checklist"
  | "storyboard";

export interface TextBoxElement {
  id: string;
  x: number;
  y: number;
  /** Largeur du bloc ; la hauteur, elle, s'ajuste automatiquement au
   * contenu (comme un bloc de texte Notion), donc non stockée. */
  width: number;
  /** Contenu riche sérialisé en HTML, produit par l'éditeur (TipTap) —
   * porte tout le formatage (gras, titres, listes, couleurs, alignement...). */
  html: string;
}

export interface ImageElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
}

export type ShapeType = "circle" | "rectangle" | "triangle" | "line";

export interface ShapeElement {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
}

export interface NotePage {
  id: string;
  title: string;
  sheetType: SheetType;
  paperSize: PaperSize;
  backgroundColor: string;
  strokes: Stroke[];
  shapes: ShapeElement[];
  textBoxes: TextBoxElement[];
  images: ImageElement[];
  lastScrollPosition: number;
  reviewCount: number;
  pinned: boolean;
  subject: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notebook {
  id: string;
  name: string;
  color: string;
  subject: string | null;
  pages: NotePage[];
}
