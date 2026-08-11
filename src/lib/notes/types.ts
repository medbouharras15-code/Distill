export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export type PenType = "fineliner" | "ballpoint" | "brush";

export interface Stroke {
  id: string;
  tool: "pen";
  penType: PenType;
  color: string;
  /** Épaisseur de base en pixels logiques (avant modulation par la pression). */
  size: number;
  points: StrokePoint[];
}

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
  width: number;
  height: number;
  content: string;
  color: string;
  fontSize: number;
}

export interface ImageElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
}

export interface ShapeElement {
  id: string;
  type: "circle" | "rectangle" | "triangle" | "line";
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
