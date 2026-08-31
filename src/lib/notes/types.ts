export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  /** Inclinaison du stylet (0 = parfaitement vertical, 1 = couché au
   * maximum), normalisée depuis tiltX/tiltY de l'Apple Pencil. Absente pour
   * la souris/le doigt (aucun capteur d'inclinaison) — traitée comme 0 par
   * le rendu du Crayon, seul outil qui l'utilise. */
  tilt?: number;
}

export type PenType = "fineliner" | "ballpoint" | "crayon" | "brush";

/** "whole" efface un trait/forme/photo/bloc de texte entier dès qu'on le
 * touche (comportement historique de la gomme) ; "partial" ne découpe que
 * les traits d'encre (stylo/surligneur) à l'endroit précis touché — les
 * formes/photos/textes restent effacés en entier même dans ce mode, une
 * "portion" n'ayant pas d'équivalent naturel pour eux (voir plan validé). */
export type EraserMode = "whole" | "partial";

/** "all" efface tout ce que touche la gomme, comme aujourd'hui ; "highlighter"
 * restreint l'effacement aux seuls traits de surlignage (stroke.tool ===
 * "highlighter") — formes/photos/textes/traits stylo ne sont alors jamais
 * touchés, même si la gomme les traverse aussi. */
export type EraserTarget = "all" | "highlighter";

export type InkTool = "pen" | "highlighter";

/** Réservé à un futur ancrage sur couche texte PDF (id de page, plage de
 * mots/bounding boxes) plutôt que des pixels bruts — vide aujourd'hui,
 * aucun surlignage n'en produit encore (voir plan validé : pas de rendu ni
 * d'import PDF dans l'éditeur actuel). N'existe que pour éviter d'avoir à
 * changer la forme de `Stroke` le jour où ce chantier démarrera. */
export type HighlightAnchor = Record<string, never>;

export type HighlighterMode = "freehand" | "straight";

export interface HighlightMeta {
  mode: HighlighterMode;
  /** Toujours absent dans cette version — voir `HighlightAnchor`. */
  anchor?: HighlightAnchor;
}

export interface Stroke {
  id: string;
  tool: InkTool;
  /** Utilisé uniquement quand tool === "pen". */
  penType?: PenType;
  /** Utilisé uniquement quand tool === "highlighter". */
  highlight?: HighlightMeta;
  color: string;
  /** Épaisseur de base en pixels logiques (avant modulation par la pression). */
  size: number;
  /** Opacité de base (0-1). Utilisé uniquement par le Surligneur (intensité
   * réglable) ; les autres outils ont leur propre opacité fixe ou dérivée
   * de la pression, voir canvasUtils.ts. */
  opacity?: number;
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
