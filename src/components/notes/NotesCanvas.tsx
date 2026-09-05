"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";
import type {
  EraserMode,
  EraserTarget,
  HighlighterMode,
  ImageElement,
  InkTool,
  PaperSize,
  PenType,
  ShapeElement,
  ShapeType,
  SheetType,
  Stroke,
  StrokePoint,
  TextBoxElement,
} from "@/lib/notes/types";
import {
  drawEraserCirclePreview,
  drawImageElement,
  drawImageSelection,
  drawShape,
  drawSheetPattern,
  drawStroke,
  drawStrokeEraseHighlight,
  imageHandleHitTest,
  imageHitTest,
  isColorDark,
  partialEraseStroke,
  shapeHitTest,
  strokeHitTest,
  type ImageHandle,
} from "@/lib/notes/canvasUtils";
import { getPageDimensions } from "@/lib/notes/sheets";
import { computeSnapTargets, detectFreehandShape, type ShapeDetectionResult } from "@/lib/notes/shapeDetection";
import {
  RULER_SNAP_THRESHOLD,
  RULER_THICKNESS,
  closestEdge,
  isPointOnRuler,
  projectOntoEdge,
  snapAngle,
  type RulerEdge,
  type RulerState,
} from "@/lib/notes/ruler";
import {
  AUTO_SCROLL_EDGE_PX,
  AUTO_SCROLL_SPEED_PX,
  DUPLICATE_OFFSET,
  LASSO_MIN_POINT_SPACING,
  MIN_SELECTION_SCALE,
  SELECTION_HANDLE_RADIUS,
  boundsIntersect,
  boundsMostlyInPolygon,
  boundsOfPoints,
  boxBounds,
  scaleImage,
  scaleShape,
  scaleStroke,
  scaleTextBox,
  strokeBounds,
  strokeMostlyInPolygon,
  textBoxBounds,
  translateAll,
  translateImage,
  translateShape,
  translateStroke,
  translateTextBox,
  unionBounds,
  type Bounds,
  type LassoClipboardData,
  type Point,
} from "@/lib/notes/lasso";
import { TextBoxOverlay } from "./TextBoxOverlay";
import type { Editor } from "@tiptap/react";
import { RulerOverlay } from "./RulerOverlay";
import { SelectionContextMenu } from "./SelectionContextMenu";

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Échec du chargement de l'image"));
    img.src = src;
  });
}

/** Vrai si (x, y) passe à moins de `radius` du rectangle englobant d'un bloc
 * de texte — `height` est la hauteur mesurée en direct (les blocs de texte
 * n'ont pas de hauteur stockée, elle s'ajuste au contenu). */
function textBoxHitTest(
  box: { x: number; y: number; width: number },
  height: number,
  x: number,
  y: number,
  radius: number,
): boolean {
  const x0 = box.x - radius;
  const x1 = box.x + box.width + radius;
  const y0 = box.y - radius;
  const y1 = box.y + height + radius;
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

/** Zoom minimum/maximum autorisé sur la feuille (pinch-to-zoom, molette
 * Ctrl+, boutons +/-) — exportées, la fenêtre de zoom partagée
 * (NotesPageClient) applique la même limite. */
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;

/** Durée pendant laquelle on ignore le tactile après une entrée stylet, pour
 * éviter que la paume de la main ne dessine pendant l'écriture. */
const PALM_REJECTION_MS = 750;

/** Détection d'un "double-tap" de la pointe du stylet sur la feuille, qui
 * bascule vers la gomme — équivalent au double-clic sur l'icône stylo,
 * pensé pour ne jamais quitter la feuille des yeux. Un simple tap isolé
 * reste une tenue de trait normale (un petit point) ; seul un second tap
 * rapproché dans le temps et l'espace déclenche le geste. */
const TAP_MAX_MOVEMENT = 10;
const TAP_MAX_DURATION_MS = 250;
const DOUBLE_TAP_MAX_INTERVAL_MS = 350;
const DOUBLE_TAP_MAX_DISTANCE = 30;

/** Durée d'immobilité du stylo par défaut (toujours appuyé) avant de tenter
 * de reconnaître un cercle, un rectangle ou un trait droit dans le tracé en
 * cours — "si on maintient l'appui", comme les Straight Lines de Notability
 * ou la correction de forme de PencilKit (Apple Notes). Configurable via la
 * prop `holdToSnapMs`. */
const DEFAULT_HOLD_TO_SNAP_MS = 600;

/** Tolérance de "gigue" (px logiques) autour du point d'ancrage du maintien.
 * Un vrai stylet/doigt envoie des `pointermove` en continu même quand
 * l'utilisateur croit rester parfaitement immobile (tremblement de la main,
 * bruit du capteur) — sans cette tolérance, chaque micro-mouvement
 * réinitialiserait le minuteur et empêcherait le maintien de jamais aboutir
 * en conditions réelles (invisible avec des événements de test synthétiques
 * qui, eux, ne bougent jamais pendant l'attente). */
const HOLD_JITTER_TOLERANCE = 4;

/** Durée de l'animation de transition quand un tracé se redresse : chaque
 * point du trait à main levée migre en douceur vers sa position sur la
 * forme propre, plutôt qu'un remplacement brutal. */
const SNAP_ANIMATION_MS = 220;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

interface SnapAnimation {
  startTime: number;
  fromPoints: StrokePoint[];
  toPoints: StrokePoint[];
}

/** Forme verrouillée après un redressement : une fois détectée, sa
 * géométrie (ligne / rectangle / cercle) ne change plus jamais — seul le
 * point `current` (l'extrémité de la ligne, ou le coin opposé à l'ancrage
 * pour une forme) continue de suivre le stylet, jusqu'au relâchement. */
interface LockedSnap {
  kind: "line" | "shape";
  /** Outil auquel appartient ce verrouillage — détermine avec quels
   * réglages (Stylo vs Surligneur) le rendre (voir renderAll) et comment le
   * committer au relâchement (voir handlePointerUp). Le Surligneur ne
   * produit jamais "shape" (voir scheduleHoldCheck). */
  tool: InkTool;
  shapeType?: ShapeType;
  anchor: { x: number; y: number };
  current: { x: number; y: number };
  color: string;
  size: number;
  /** Utilisé uniquement quand tool === "pen". */
  penType?: PenType;
}

/** Calcule la forme verrouillée à partir du résultat de détection :
 * l'ancrage est choisi comme le point de départ (pour une ligne) ou le
 * coin de la boîte englobante le plus proche du tout premier point du
 * tracé (pour un cercle/rectangle) — celui qui reste fixe pendant que le
 * stylet continue d'ajuster l'autre extrémité. */
function deriveLockedSnap(
  result: NonNullable<ShapeDetectionResult>,
  originPoint: { x: number; y: number },
  color: string,
  size: number,
  penType: PenType,
): LockedSnap {
  if (result.kind === "line") {
    const [start, end] = result.points;
    return {
      kind: "line",
      tool: "pen",
      anchor: { x: start.x, y: start.y },
      current: { x: end.x, y: end.y },
      color,
      size,
      penType,
    };
  }

  const { shape } = result;
  const x0 = shape.x;
  const x1 = shape.x + shape.width;
  const y0 = shape.y;
  const y1 = shape.y + shape.height;
  const anchorX = Math.abs(originPoint.x - x0) <= Math.abs(originPoint.x - x1) ? x0 : x1;
  const anchorY = Math.abs(originPoint.y - y0) <= Math.abs(originPoint.y - y1) ? y0 : y1;

  return {
    kind: "shape",
    tool: "pen",
    shapeType: shape.type,
    anchor: { x: anchorX, y: anchorY },
    current: { x: anchorX === x0 ? x1 : x0, y: anchorY === y0 ? y1 : y0 },
    color,
    size,
  };
}

/** Écart (degrés) sous lequel le mode Droit du Surligneur accroche
 * exactement à l'horizontale/verticale plutôt que de suivre l'angle brut du
 * geste — juste assez large pour rattraper un tracé "presque droit" sans
 * empêcher de tracer volontairement à un autre angle. */
const STRAIGHT_HIGHLIGHT_SNAP_DEG = 6;

/** Point d'arrivée du mode Droit du Surligneur : accroche à 0°/90°/180°/270°
 * si le geste en est déjà proche, sinon suit l'angle réel du geste — un
 * simple tracé à 2 points (ancrage → point courant), pas d'accumulation. */
function snapStraightEndpoint(anchor: StrokePoint, current: StrokePoint): StrokePoint {
  const dx = current.x - anchor.x;
  const dy = current.y - anchor.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return current;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const nearestAxis = Math.round(angleDeg / 90) * 90;
  if (Math.abs(angleDeg - nearestAxis) > STRAIGHT_HIGHLIGHT_SNAP_DEG) return current;
  const rad = (nearestAxis * Math.PI) / 180;
  return { ...current, x: anchor.x + Math.cos(rad) * length, y: anchor.y + Math.sin(rad) * length };
}

export type NotesTool = "pen" | "highlighter" | "eraser" | "shapes" | "photo" | "pan" | "text" | "lasso";

export interface NotesCanvasHandle {
  undo(): void;
  redo(): void;
  importPhotos(files: FileList | File[]): void;
  /** Colle le contenu du presse-papiers partagé (voir NotesPageClient) sur
   * cette page — no-op si le presse-papiers est vide. */
  paste(): void;
  /** Drag cross-page du Lasso (voir CrossPageDragBridge) — affiche/efface un
   * aperçu "fantôme" d'une sélection en cours de glisser depuis une AUTRE
   * page, déjà exprimé dans le repère logique de CETTE page. Ne touche
   * jamais le Document/historique de cette page : purement un aperçu. */
  setIncomingSelectionPreview(data: LassoClipboardData | null): void;
  /** Drag cross-page du Lasso : ajoute réellement `data` (coordonnées déjà
   * exactes pour cette page, mêmes ids que l'original — un déplacement, pas
   * une copie) en UN SEUL commitDoc, et en fait la nouvelle sélection de
   * cette page — même esprit que Coller cross-page déjà validé. */
  receiveTransferredSelection(data: LassoClipboardData): void;
}

/** Pont imperatif (refs uniquement, jamais de state React — même esprit que
 * `containerRef`) construit par NotesPageClient et partagé par toutes les
 * pages, pour le drag cross-page du Lasso : détecter sous quelle page se
 * trouve la sélection en cours de glisser, lui pousser un aperçu, et
 * effectuer le transfert réel au relâchement. Ne remplace pas
 * `NotesCanvasHandle` (déjà utilisé pour Annuler/Rétablir/Coller) : ce pont
 * sert spécifiquement aux communications déclenchées PENDANT un geste
 * (fréquence pointermove), donc jamais via un state React qui forcerait un
 * re-rendu de NotesPageClient à chaque frame. */
export interface CrossPageDragBridge {
  /** Ids de toutes les pages du carnet, dans l'ordre d'affichage (haut en
   * bas) — pour retrouver la page sous un point donné de l'écran. */
  pageIds: string[];
  /** Rect (coordonnées écran/viewport) du slot d'une page, ou `null` si
   * cette page n'est pas (encore) montée. */
  getPageRect(pageId: string): DOMRect | null;
  /** Pousse (ou efface avec `null`) l'aperçu fantôme affiché par la page
   * `pageId` — voir `setIncomingSelectionPreview`. */
  setPreview(pageId: string, data: LassoClipboardData | null): void;
  /** Effectue le transfert réel vers `pageId` au relâchement — voir
   * `receiveTransferredSelection` — et fait de cette page la page active. */
  transfer(pageId: string, data: LassoClipboardData): void;
}

export interface Document {
  strokes: Stroke[];
  shapes: ShapeElement[];
  images: ImageElement[];
  textBoxes: TextBoxElement[];
}

/** Ids des éléments actuellement sélectionnés par le Lasso — jamais lu par
 * `commitDoc`/`Document`, purement de l'état UI local à cette page. */
interface SelectionIds {
  strokes: Set<string>;
  shapes: Set<string>;
  images: Set<string>;
  textBoxes: Set<string>;
}

type SelectionHandle = "nw" | "ne" | "se" | "sw";

type SelectionTransform = { dx: number; dy: number } | { anchor: Point; scale: number };

/** Applique la transformation "en direct" d'un geste de sélection Lasso à
 * un seul élément — utilisée à la fois par le rendu canvas (renderAll,
 * traits/formes/photos) et par le calcul des blocs de texte affichés
 * (displayTextBoxes), avec les mêmes fonctions `translate*`/`scale*` que
 * celles utilisées au commit final (lib/notes/lasso.ts) : jamais deux
 * implémentations différentes pour l'aperçu et le résultat réel. */
function applySelectionTransform<T>(
  el: T,
  t: SelectionTransform,
  translateFn: (el: T, dx: number, dy: number) => T,
  scaleFn: (el: T, anchor: Point, scale: number) => T,
): T {
  return "dx" in t ? translateFn(el, t.dx, t.dy) : scaleFn(el, t.anchor, t.scale);
}

/** Dessine l'encadré pointillé + les 4 poignées de coin d'une sélection —
 * partagé entre la sélection locale de cette page et l'aperçu fantôme d'une
 * sélection en cours de glisser depuis une autre page (drag cross-page du
 * Lasso), pour ne jamais avoir deux implémentations visuelles différentes. */
function drawSelectionBoxAndHandles(ctx: CanvasRenderingContext2D, b: Bounds) {
  ctx.save();
  ctx.strokeStyle = "rgba(31, 92, 74, 0.85)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  ctx.setLineDash([]);
  ctx.fillStyle = "#ffffff";
  const corners: Point[] = [
    { x: b.x0, y: b.y0 },
    { x: b.x1, y: b.y0 },
    { x: b.x1, y: b.y1 },
    { x: b.x0, y: b.y1 },
  ];
  for (const c of corners) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, SELECTION_HANDLE_RADIUS / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Taille par défaut (unités logiques de page) d'un nouveau bloc de texte
 * créé d'un tap/clic avec l'outil "T". */
const DEFAULT_TEXTBOX_WIDTH = 260;
const MIN_TEXTBOX_HIT_HEIGHT = 32;

interface NotesCanvasProps {
  /** Id de cette page — nécessaire uniquement pour le drag cross-page du
   * Lasso (voir `crossPageDrag`), pour que cette instance sache se
   * reconnaître (se distinguer d'une éventuelle page cible) dans le pont
   * partagé par NotesPageClient. */
  pageId: string;
  /** Pont partagé (voir CrossPageDragBridge) permettant au Lasso de
   * détecter/transférer une sélection glissée vers une autre page du même
   * carnet — un seul objet stable pour tout le carnet, comme `containerRef`. */
  crossPageDrag: CrossPageDragBridge;
  tool: NotesTool;
  penColor: string;
  penSize: number;
  penType: PenType;
  highlighterColor: string;
  highlighterSize: number;
  highlighterMode: HighlighterMode;
  highlighterOpacity: number;
  eraserRadius: number;
  eraserMode: EraserMode;
  eraserTarget: EraserTarget;
  shapeType: ShapeType;
  shapeColor: string;
  shapeStrokeWidth: number;
  sheetType: SheetType;
  paperSize: PaperSize;
  backgroundColor?: string;
  /** Niveau de zoom partagé par toutes les pages du carnet (1 = 100%),
   * affiché seulement (pour dimensionner le curseur/les calculs internes) —
   * la fenêtre de zoom/défilement elle-même (conteneur+wrapper) appartient
   * désormais à NotesPageClient, voir `containerRef`/`onPinchZoom`. */
  zoom: number;
  /** Conteneur de défilement partagé par tout le carnet (un seul, possédé
   * par NotesPageClient, pas un par page) — l'outil Déplacement y écrit
   * directement `scrollLeft`/`scrollTop`, ce qui suffit à faire défiler
   * en continu jusqu'à la page suivante/précédente puisque c'est le même
   * élément pour toutes les pages. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Appelé quand cette page détecte un geste de zoom (pincement à deux
   * doigts, molette Ctrl+) avec le nouveau niveau de zoom brut visé et le
   * point client (clientX/clientY) sur lequel ancrer le zoom — le calcul
   * réel (mesure du wrapper, défilement corrigé) est fait par
   * NotesPageClient, qui possède la fenêtre partagée. */
  onPinchZoom: (newZoomRaw: number, clientX: number, clientY: number) => void;
  /** Durée d'immobilité (ms, stylet toujours appuyé) avant la détection de
   * forme automatique. Défaut 600ms. */
  holdToSnapMs?: number;
  /** Affiche un indicateur de debug temporaire (état du minuteur de
   * maintien en direct) — pour diagnostiquer sur un appareil réel où la
   * console n'est pas facilement accessible. */
  debugHoldDetection?: boolean;
  /** Appelé après chaque trait terminé (dessiné ou effacé). */
  onActionComplete?: () => void;
  /** Appelé quand un double-tap de la pointe du stylet est détecté sur la
   * feuille (bascule rapide vers la gomme). */
  onPenDoubleTap?: () => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  /** Contenu restauré (sauvegarde Supabase, utilisateur connecté) à charger
   * au montage — ignoré après le premier rendu (changer cette prop en cours
   * de vie du composant ne réhydrate pas). Absent : page vide, comme
   * aujourd'hui (visiteur non connecté, ou nouvelle page jamais sauvegardée).
   * La pile annuler/rétablir démarre toujours vide, y compris avec un
   * contenu restauré : charger n'est pas une action "annulable". */
  initialDocument?: Document;
  /** Appelé (débounce ~1s) après chaque changement de contenu validé —
   * jamais pour le tout premier rendu (évite un aller-retour réseau inutile
   * juste après l'hydratation depuis `initialDocument`). Sert à
   * l'autosauvegarde, voir NotesPageClient — absent pour un visiteur non
   * connecté (aucun appel réseau dans ce cas). */
  onDocChange?: (doc: Document) => void;
  /** Vrai seulement pour la page qui "possède" actuellement la Règle (la
   * dernière touchée pendant que l'instrument est actif, voir
   * NotesPageClient) — une seule page à la fois a une règle visible/
   * interactive. Un simple toggle indépendant de `tool` : Stylo/Crayon/etc.
   * restent sélectionnés pendant que la Règle est active. */
  rulerActive?: boolean;
  /** Presse-papiers interne du Lasso — partagé au niveau de
   * NotesPageClient (pas local à cette page) pour permettre de copier sur
   * une page et coller sur une autre du même carnet. `null` = vide. */
  clipboard?: LassoClipboardData | null;
  /** Appelé quand Copier/Couper remplace le contenu du presse-papiers. */
  onClipboardChange?: (data: LassoClipboardData) => void;
  /** Relais pur vers chaque TextBoxOverlay (voir TextBoxOverlay.tsx) —
   * NotesCanvas ne fait qu'y transmettre ce prop, la barre riche du
   * carnet (rendue par NotesPageClient, plus liée à la position d'une
   * TextBox) en a besoin pour savoir quelle instance TipTap contrôler. */
  onActiveTextEditorChange?: (editor: Editor, active: boolean) => void;
}

export const NotesCanvas = forwardRef<NotesCanvasHandle, NotesCanvasProps>(function NotesCanvas(
  {
    pageId,
    crossPageDrag,
    tool,
    penColor,
    penSize,
    penType,
    highlighterColor,
    highlighterSize,
    highlighterMode,
    highlighterOpacity,
    eraserRadius,
    eraserMode,
    eraserTarget,
    shapeType,
    shapeColor,
    shapeStrokeWidth,
    sheetType,
    paperSize,
    backgroundColor = "#ffffff",
    zoom,
    containerRef,
    onPinchZoom,
    holdToSnapMs = DEFAULT_HOLD_TO_SNAP_MS,
    debugHoldDetection = false,
    onActionComplete,
    onPenDoubleTap,
    onHistoryChange,
    initialDocument,
    onDocChange,
    rulerActive = false,
    clipboard = null,
    onClipboardChange,
    onActiveTextEditorChange,
  },
  ref,
) {
  const { width: PAGE_WIDTH, height: PAGE_HEIGHT } = getPageDimensions(paperSize);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [strokes, setStrokes] = useState<Stroke[]>(() => initialDocument?.strokes ?? []);
  const [shapes, setShapes] = useState<ShapeElement[]>(() => initialDocument?.shapes ?? []);
  const [images, setImages] = useState<ImageElement[]>(() => initialDocument?.images ?? []);
  const [textBoxes, setTextBoxes] = useState<TextBoxElement[]>(() => initialDocument?.textBoxes ?? []);
  const strokesRef = useRef<Stroke[]>(strokes);
  const shapesRef = useRef<ShapeElement[]>(shapes);
  const imagesRef = useRef<ImageElement[]>(images);
  const textBoxesRef = useRef<TextBoxElement[]>(textBoxes);
  const undoStack = useRef<Document[]>([]);
  const redoStack = useRef<Document[]>([]);

  const activePointerId = useRef<number | null>(null);
  const currentStroke = useRef<Stroke | null>(null);
  const currentShape = useRef<ShapeElement | null>(null);
  const shapeStartPos = useRef<{ x: number; y: number } | null>(null);
  const erasedStrokeIds = useRef<Set<string> | null>(null);
  const erasedShapeIds = useRef<Set<string> | null>(null);
  const erasedImageIds = useRef<Set<string> | null>(null);
  const erasedTextBoxIds = useRef<Set<string> | null>(null);
  const partialErasePreview = useRef<Stroke[] | null>(null);
  /** Position (espace canvas) du curseur/stylet en survol avec l'outil
   * Gomme, avant tout clic — null quand rien n'est survolé (tactile inclus,
   * puisque le tactile ne déclenche pas d'événement pointermove sans
   * contact). Alimente l'aperçu au survol (voir renderAll). */
  const hoverEraserPos = useRef<StrokePoint | null>(null);
  /** Id du trait sous le curseur en mode Gomme totale, pour le surligner
   * avant le clic — non utilisé en mode partielle. */
  const hoveredStrokeId = useRef<string | null>(null);
  /** Dernière position effacée pendant le geste de Gomme actif (espace
   * document) — sert à interpoler entre deux `pointermove` (voir
   * eraseAlongPath) pour qu'un swipe rapide n'enjambe pas un petit trait
   * situé entre deux positions échantillonnées. Null hors geste actif. */
  const lastEraserPos = useRef<{ x: number; y: number } | null>(null);
  const lastPenTime = useRef(0);
  const renderScheduled = useRef(false);

  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const imageDragMode = useRef<{
    id: string;
    mode: "move" | ImageHandle;
    startPos: { x: number; y: number };
    startElement: ImageElement;
  } | null>(null);
  /** Géométrie "live" de l'image en cours de déplacement/redimensionnement,
   * utilisée uniquement pour l'aperçu pendant le geste — `imagesRef.current`
   * lui-même n'est modifié qu'au moment du commit (relâchement), pour que
   * l'instantané "avant" poussé sur la pile d'annulation reste correct. */
  const dragPreview = useRef<ImageElement | null>(null);

  /** Blocs de texte fraîchement créés (tap avec l'outil "T") mais pas
   * encore commités dans le document/l'historique — tant qu'on n'a rien
   * tapé dedans. Ça évite de polluer la pile d'annulation d'un "créer un
   * bloc vide" suivi d'un "le retirer" si l'utilisateur clique puis
   * clique ailleurs sans avoir écrit ; un bloc n'est réellement ajouté au
   * document (via commitDoc) qu'à la perte de focus, s'il contient du
   * texte. Un tableau (pas un simple `| null`) pour rester correct même si
   * un second brouillon est créé avant que le focus n'ait quitté le
   * premier (le blur du premier arrive après coup, de façon asynchrone). */
  const [draftTextBoxes, setDraftTextBoxes] = useState<TextBoxElement[]>([]);
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null);
  const [autoFocusTextBoxId, setAutoFocusTextBoxId] = useState<string | null>(null);
  /** Hauteur réellement rendue (mesurée en direct par chaque bloc via
   * ResizeObserver) de chaque bloc de texte, en unités logiques de page —
   * `TextBoxElement` ne stocke pas de hauteur (elle s'ajuste au contenu),
   * mais la gomme a besoin d'une boîte englobante pour détecter un contact. */
  const textBoxHeights = useRef<Map<string, number>>(new Map());

  /** 1 = 100% : la fenêtre de zoom/défilement partagée par tout le carnet
   * (conteneur+wrapper) appartient à NotesPageClient, voir la prop
   * `containerRef`/`onPinchZoom` — cette page ne fait plus que détecter le
   * geste (pincement, molette) et déléguer le calcul au parent. */
  const touchPoints = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchState = useRef<{ initialDistance: number; initialZoom: number } | null>(null);

  /** Géométrie de la Règle pour cette page — `null` tant qu'elle n'a jamais
   * été activée ici (voir positionnement initial dans l'effet ci-dessous).
   * Volontairement un `useState` LOCAL à ce composant, jamais lu par
   * `commitDoc`/`Document` : la Règle n'est jamais un `Stroke`, jamais
   * sauvegardée, jamais dans undo/redo — seuls les traits qu'elle contraint
   * (voir applyRulerConstraint) deviennent de vraies données. */
  const [ruler, setRuler] = useState<RulerState | null>(null);
  /** pointerId des doigts actuellement posés sur le corps de la règle (0,
   * 1 ou 2) — distinct de `touchPoints`/`pinchState` du pincement-zoom : un
   * doigt sur la règle ne doit jamais déclencher le zoom (voir
   * handlePointerDown). */
  const rulerTouchIds = useRef<number[]>([]);
  const rulerLiveClientPos = useRef<Map<number, { x: number; y: number }>>(new Map());
  /** Instantané pris à chaque changement du nombre de doigts sur la règle
   * (0→1, 1→2, 2→1) : position de la règle + positions écran des doigts
   * *à cet instant*, pour calculer un delta de translation/rotation sans
   * jamais faire "sauter" la règle au changement de doigt. */
  const rulerGestureStart = useRef<{ ruler: RulerState; touches: Map<number, { x: number; y: number }> } | null>(
    null,
  );
  const [rulerRotating, setRulerRotating] = useState(false);
  /** Bord de la règle auquel le trait en cours est accroché (voir
   * `RULER_SNAP_THRESHOLD`) — décidé une seule fois au posé du Pencil, pour
   * toute la durée du trait ; `null` = trait libre, la Règle est présente
   * mais ne le contraint pas. */
  const rulerStrokeEdge = useRef<RulerEdge | null>(null);

  /** Position/angle initiaux de la Règle à sa toute première activation
   * pour cette page : centrée horizontalement, verticalement au milieu de
   * la portion actuellement visible dans le conteneur de défilement
   * partagé — pas toujours au centre de la page entière (l'utilisateur
   * peut être scrollé n'importe où dans une longue page). Ne se déclenche
   * qu'une fois par page (garde `ruler === null`) ; les activations
   * suivantes gardent la position/l'angle où l'utilisateur les a laissés. */
  useEffect(() => {
    if (!rulerActive || ruler !== null) return;
    const root = rootRef.current;
    const container = containerRef.current;
    let initY = PAGE_HEIGHT / 2;
    if (root && container) {
      const rootRect = root.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const visibleTop = Math.max(rootRect.top, containerRect.top);
      const visibleBottom = Math.min(rootRect.bottom, containerRect.bottom);
      if (visibleBottom > visibleTop && rootRect.height > 0) {
        const visibleCenterClientY = (visibleTop + visibleBottom) / 2;
        const scaleY = PAGE_HEIGHT / rootRect.height;
        initY = (visibleCenterClientY - rootRect.top) * scaleY;
        initY = Math.max(RULER_THICKNESS, Math.min(PAGE_HEIGHT - RULER_THICKNESS, initY));
      }
    }
    setRuler({ x: PAGE_WIDTH / 2, y: initY, angleDeg: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rulerActive]);

  // ---------------------------------------------------------------------
  // Lasso — sélection libre multi-éléments. `selection` ne vit jamais dans
  // Document/commitDoc : ce n'est jamais un Stroke, jamais sauvegardé,
  // jamais dans undo/redo — seuls les éléments réellement déplacés/
  // redimensionnés/dupliqués/supprimés/collés le sont, via commitDoc comme
  // n'importe quel autre outil.
  // ---------------------------------------------------------------------

  const [selection, setSelection] = useState<SelectionIds | null>(null);
  /** Points du tracé du lasso en cours (espace document), simplifiés au fil
   * de l'eau (voir simplifyLassoPath) — jamais sauvegardé, purement visuel
   * pendant le geste (voir renderAll). */
  const lassoPath = useRef<Point[]>([]);

  /** Geste de manipulation d'une sélection existante (déplacer ou
   * redimensionner) — même schéma que `imageDragMode` : rien n'est muté
   * dans les refs de contenu tant que le geste continue, seul
   * `selectionTransform` (ci-dessous) porte l'état "en direct". */
  const selectionDragMode = useRef<{
    mode: "move" | SelectionHandle;
    startPos: Point;
    startBounds: Bounds;
  } | null>(null);
  /** Transformation "en direct" appliquée uniquement à l'affichage (voir
   * renderAll et displayTextBoxes) — jamais aux tableaux réels avant le
   * commit final au relâchement (une seule action Undo par geste). */
  const selectionTransform = useRef<SelectionTransform | null>(null);
  /** Force un rendu pendant un déplacement/redimensionnement de sélection
   * (les refs ci-dessus ne déclenchent pas de rendu par elles-mêmes). */
  const [, setSelectionTick] = useState(0);
  /** Vrai pendant un déplacement/redimensionnement de sélection — sert
   * uniquement à masquer le menu contextuel pendant le geste (voir JSX). */
  const [selectionDragging, setSelectionDragging] = useState(false);

  /** Aperçu "fantôme" d'une sélection en cours de glisser depuis une AUTRE
   * page (drag cross-page du Lasso) — déjà en coordonnées locales à CETTE
   * page, jamais dans son Document/historique. `null` la plupart du temps. */
  const incomingPreviewRef = useRef<LassoClipboardData | null>(null);
  /** Miroir React (état, pas juste la ref ci-dessus) des SEULS blocs de
   * texte de l'aperçu fantôme — comme pour `setSelectionTick`, le texte est
   * rendu en DOM (pas sur le canvas), donc a besoin d'un vrai rendu React
   * pour suivre ; traits/formes/photos, eux, se redessinent via le canvas
   * (scheduleRender suffit, voir setIncomingSelectionPreview). */
  const [incomingPreviewTextBoxes, setIncomingPreviewTextBoxes] = useState<TextBoxElement[]>([]);
  /** Pendant un déplacement (mode "move" uniquement, jamais un
   * redimensionnement) : page actuellement "verrouillée" comme destination
   * potentielle du transfert si elle diffère de cette page, avec le (dx,dy)
   * déjà calculé pour repositionner la sélection dans son repère — `null`
   * tant que le glisser reste sur cette page. Lu une dernière fois au
   * relâchement (voir endStroke) pour effectuer le transfert réel. */
  const crossPageTargetRef = useRef<{ pageId: string; dx: number; dy: number } | null>(null);
  /** Dernière position écran (clientX/clientY) connue du pointeur pendant un
   * déplacement de sélection — relue par la boucle d'auto-scroll (voir
   * updateAutoScrollForSelectionDrag) pour recalculer la position logique
   * quand la page défile sous un pointeur qui, lui, ne bouge pas. */
  const dragLastClientPosRef = useRef<{ x: number; y: number } | null>(null);
  /** Direction active de l'auto-scroll (-1 haut, 1 bas, 0 arrêté). */
  const autoScrollDirRef = useRef<-1 | 0 | 1>(0);
  /** Id de la frame `requestAnimationFrame` de la boucle d'auto-scroll en
   * cours, ou `null` si elle est arrêtée. */
  const autoScrollRafRef = useRef<number | null>(null);

  /** Boîte englobante brute (non transformée) de la sélection actuelle, à
   * partir des éléments réels — recalculée à chaque rendu, coût
   * négligeable (la sélection ne contient jamais des milliers d'éléments). */
  function rawSelectionBounds(sel: SelectionIds): Bounds | null {
    let bounds: Bounds | null = null;
    for (const s of strokesRef.current) {
      if (!sel.strokes.has(s.id)) continue;
      bounds = bounds ? unionBounds(bounds, strokeBounds(s)) : strokeBounds(s);
    }
    for (const s of shapesRef.current) {
      if (!sel.shapes.has(s.id)) continue;
      bounds = bounds ? unionBounds(bounds, boxBounds(s)) : boxBounds(s);
    }
    for (const img of imagesRef.current) {
      if (!sel.images.has(img.id)) continue;
      bounds = bounds ? unionBounds(bounds, boxBounds(img)) : boxBounds(img);
    }
    for (const t of textBoxesRef.current) {
      if (!sel.textBoxes.has(t.id)) continue;
      const h = textBoxHeights.current.get(t.id) ?? MIN_TEXTBOX_HIT_HEIGHT;
      const b = textBoxBounds(t, h);
      bounds = bounds ? unionBounds(bounds, b) : b;
    }
    return bounds;
  }

  /** Applique la transformation "en direct" (voir `selectionTransform`) à
   * une boîte englobante — une translation/mise à l'échelle de bbox est
   * juste la même transformation appliquée à ses deux coins. */
  function displayBounds(bounds: Bounds): Bounds {
    const t = selectionTransform.current;
    if (!t) return bounds;
    if ("dx" in t) {
      return { x0: bounds.x0 + t.dx, y0: bounds.y0 + t.dy, x1: bounds.x1 + t.dx, y1: bounds.y1 + t.dy };
    }
    const scalePt = (x: number, y: number) => ({
      x: t.anchor.x + (x - t.anchor.x) * t.scale,
      y: t.anchor.y + (y - t.anchor.y) * t.scale,
    });
    const p0 = scalePt(bounds.x0, bounds.y0);
    const p1 = scalePt(bounds.x1, bounds.y1);
    return { x0: Math.min(p0.x, p1.x), y0: Math.min(p0.y, p1.y), x1: Math.max(p0.x, p1.x), y1: Math.max(p0.y, p1.y) };
  }

  /** Poignée de coin (ou `null`) sous (x, y) pour la sélection actuelle. */
  function selectionHandleHitTest(bounds: Bounds, x: number, y: number): SelectionHandle | null {
    const corners: Record<SelectionHandle, Point> = {
      nw: { x: bounds.x0, y: bounds.y0 },
      ne: { x: bounds.x1, y: bounds.y0 },
      se: { x: bounds.x1, y: bounds.y1 },
      sw: { x: bounds.x0, y: bounds.y1 },
    };
    for (const handle of Object.keys(corners) as SelectionHandle[]) {
      const c = corners[handle];
      if (Math.hypot(c.x - x, c.y - y) <= SELECTION_HANDLE_RADIUS + 6) return handle;
    }
    return null;
  }

  function isPointInBounds(bounds: Bounds, x: number, y: number): boolean {
    return x >= bounds.x0 && x <= bounds.x1 && y >= bounds.y0 && y <= bounds.y1;
  }

  /** Démarre un déplacement/redimensionnement de la sélection actuelle. */
  function beginSelectionDrag(mode: "move" | SelectionHandle, pos: Point, bounds: Bounds) {
    selectionDragMode.current = { mode, startPos: { x: pos.x, y: pos.y }, startBounds: bounds };
    selectionTransform.current = mode === "move" ? { dx: 0, dy: 0 } : { anchor: pos, scale: 1 };
    // État React (pas juste la ref) uniquement pour masquer le menu
    // contextuel pendant le geste — la boîte/les traits eux-mêmes se
    // redessinent via scheduleRender()/renderAll, pas via ce state.
    setSelectionDragging(true);
  }

  /** Construit les 4 tableaux du document avec la transformation "en
   * direct" réellement appliquée aux éléments sélectionnés — utilisé une
   * seule fois, au relâchement (voir commitSelectionDrag), jamais pendant
   * le geste (l'aperçu pendant le geste est calculé au vol dans renderAll/
   * displayTextBoxes, sans jamais toucher ces tableaux). */
  function transformedDocument(sel: SelectionIds, t: SelectionTransform) {
    const isTranslate = "dx" in t;
    return {
      strokes: strokesRef.current.map((s) =>
        !sel.strokes.has(s.id) ? s : isTranslate ? translateStroke(s, t.dx, t.dy) : scaleStroke(s, t.anchor, t.scale),
      ),
      shapes: shapesRef.current.map((s) =>
        !sel.shapes.has(s.id) ? s : isTranslate ? translateShape(s, t.dx, t.dy) : scaleShape(s, t.anchor, t.scale),
      ),
      images: imagesRef.current.map((img) =>
        !sel.images.has(img.id) ? img : isTranslate ? translateImage(img, t.dx, t.dy) : scaleImage(img, t.anchor, t.scale),
      ),
      textBoxes: textBoxesRef.current.map((tb) =>
        !sel.textBoxes.has(tb.id) ? tb : isTranslate ? translateTextBox(tb, t.dx, t.dy) : scaleTextBox(tb, t.anchor, t.scale),
      ),
    };
  }

  /** Termine un déplacement/redimensionnement de sélection et committe le
   * résultat en une seule action Undo — comme `commitImageInteraction`. */
  function commitSelectionDrag() {
    const drag = selectionDragMode.current;
    const t = selectionTransform.current;
    selectionDragMode.current = null;
    selectionTransform.current = null;
    setSelectionDragging(false);
    if (!drag || !t || !selection) return;
    const hasMoved = "dx" in t ? t.dx !== 0 || t.dy !== 0 : t.scale !== 1;
    if (!hasMoved) return;
    commitDoc(transformedDocument(selection, t));
  }

  /** Copie profonde des éléments sélectionnés — utilisée par Copier/
   * Couper/Dupliquer. Ne touche jamais `commitDoc` elle-même : Copier ne
   * doit rien committer, seul Dupliquer/Coller/Supprimer le font. */
  function cloneSelected(sel: SelectionIds): LassoClipboardData {
    return {
      strokes: strokesRef.current.filter((s) => sel.strokes.has(s.id)).map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) })),
      shapes: shapesRef.current.filter((s) => sel.shapes.has(s.id)).map((s) => ({ ...s })),
      images: imagesRef.current.filter((img) => sel.images.has(img.id)).map((img) => ({ ...img })),
      textBoxes: textBoxesRef.current.filter((tb) => sel.textBoxes.has(tb.id)).map((tb) => ({ ...tb })),
    };
  }

  // -------------------------------------------------------------------
  // Drag cross-page du Lasso — voir CrossPageDragBridge/le plan validé.
  // Restreint au déplacement (mode "move") : redimensionner par-dessus une
  // frontière de page n'a pas de sens demandé, non traité ici.
  // -------------------------------------------------------------------

  /** Équivalent de `getPos` mais à partir d'un point écran brut plutôt que
   * d'un `PointerEvent` — nécessaire pour la boucle d'auto-scroll, qui
   * recalcule la position logique sans nouvel événement pointeur (le
   * document défile sous un pointeur qui, lui, ne bouge pas). Même formule
   * que `getPos`, volontairement dupliquée plutôt que d'y toucher. */
  function logicalFromClient(clientX: number, clientY: number): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: (clientX - rect.left) * (PAGE_WIDTH / rect.width), y: (clientY - rect.top) * (PAGE_HEIGHT / rect.height) };
  }

  function stopAutoScroll() {
    autoScrollDirRef.current = 0;
    if (autoScrollRafRef.current !== null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  }

  /** Nettoie tout état de drag cross-page (auto-scroll + aperçu fantôme
   * éventuellement posé sur une autre page) — appelée à l'annulation du
   * geste et après un transfert réel (voir handlePointerCancel/endStroke). */
  function clearCrossPageDragState() {
    stopAutoScroll();
    if (crossPageTargetRef.current) {
      crossPageDrag.setPreview(crossPageTargetRef.current.pageId, null);
      crossPageTargetRef.current = null;
    }
    dragLastClientPosRef.current = null;
  }

  /** Recalcule tout ce qui dépend de la position du pointeur pendant un
   * déplacement de sélection : la transformation "en direct" elle-même
   * (comme le ferait un pointermove), puis la détection de la page sous le
   * centre de la sélection et l'aperçu fantôme à y pousser. Appelée à la
   * fois par le vrai pointermove et par la boucle d'auto-scroll. */
  function updateCrossPageSelectionDrag(clientX: number, clientY: number) {
    const drag = selectionDragMode.current;
    if (!drag || drag.mode !== "move" || !selection) return;
    const pos = logicalFromClient(clientX, clientY);
    const dx = pos.x - drag.startPos.x;
    const dy = pos.y - drag.startPos.y;
    selectionTransform.current = { dx, dy };

    const raw = rawSelectionBounds(selection);
    if (!raw) return;
    const b = displayBounds(raw);
    const centerClientY = (() => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const scaleY = rect.height / PAGE_HEIGHT;
      return rect.top + ((b.y0 + b.y1) / 2) * scaleY;
    })();

    let targetId: string | null = null;
    for (const id of crossPageDrag.pageIds) {
      const r = crossPageDrag.getPageRect(id);
      if (r && centerClientY >= r.top && centerClientY < r.bottom) {
        targetId = id;
        break;
      }
    }

    const prevTarget = crossPageTargetRef.current;
    if (targetId === null || targetId === pageId) {
      if (prevTarget) {
        crossPageDrag.setPreview(prevTarget.pageId, null);
        crossPageTargetRef.current = null;
      }
      return;
    }

    const sourceRect = crossPageDrag.getPageRect(pageId);
    const targetRect = crossPageDrag.getPageRect(targetId);
    if (!sourceRect || !targetRect) return;
    const scaleXTarget = targetRect.width / PAGE_WIDTH;
    const scaleYTarget = targetRect.height / PAGE_HEIGHT;
    const dxToTarget = (sourceRect.left - targetRect.left) / scaleXTarget;
    const dyToTarget = (sourceRect.top - targetRect.top) / scaleYTarget;

    if (prevTarget && prevTarget.pageId !== targetId) {
      crossPageDrag.setPreview(prevTarget.pageId, null);
    }
    const totalDx = dx + dxToTarget;
    const totalDy = dy + dyToTarget;
    crossPageTargetRef.current = { pageId: targetId, dx: totalDx, dy: totalDy };
    crossPageDrag.setPreview(targetId, translateAll(cloneSelected(selection), totalDx, totalDy));
  }

  /** Démarre/arrête l'auto-scroll doux selon la position écran du pointeur
   * par rapport aux bords haut/bas du conteneur de défilement partagé — la
   * boucle s'arrête net dès que le pointeur s'éloigne du bord (ou au
   * relâchement/annulation, voir clearCrossPageDragState). Chaque frame
   * active recalcule aussi la position de la sélection et la page cible,
   * puisque le document défile sous un pointeur qui, lui, reste immobile. */
  function updateAutoScrollForSelectionDrag(clientY: number) {
    const container = containerRef.current;
    if (!container || !selectionDragMode.current || selectionDragMode.current.mode !== "move") {
      stopAutoScroll();
      return;
    }
    const rect = container.getBoundingClientRect();
    let dir: -1 | 0 | 1 = 0;
    if (clientY < rect.top + AUTO_SCROLL_EDGE_PX) dir = -1;
    else if (clientY > rect.bottom - AUTO_SCROLL_EDGE_PX) dir = 1;
    autoScrollDirRef.current = dir;
    if (dir === 0) {
      stopAutoScroll();
      return;
    }
    if (autoScrollRafRef.current !== null) return;
    const tick = () => {
      if (autoScrollDirRef.current === 0 || !selectionDragMode.current) {
        autoScrollRafRef.current = null;
        return;
      }
      const c = containerRef.current;
      if (c) c.scrollTop += AUTO_SCROLL_SPEED_PX * autoScrollDirRef.current;
      const last = dragLastClientPosRef.current;
      if (last) updateCrossPageSelectionDrag(last.x, last.y);
      scheduleRender();
      autoScrollRafRef.current = requestAnimationFrame(tick);
    };
    autoScrollRafRef.current = requestAnimationFrame(tick);
  }

  /** Voir NotesCanvasHandle. Purement un aperçu (ref), jamais le
   * Document/historique de cette page. Omise des dépendances de
   * useImperativeHandle ci-dessous (comme `getOrLoadImage`) : ne ferme que
   * sur des refs/setState stables, jamais une prop qui change — son
   * identité entre deux rendus n'a donc aucune incidence sur son comportement. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  function setIncomingSelectionPreview(data: LassoClipboardData | null) {
    incomingPreviewRef.current = data;
    setIncomingPreviewTextBoxes(data?.textBoxes ?? []);
    scheduleRender();
  }

  /** Voir NotesCanvasHandle. `data` est déjà en coordonnées exactes pour
   * cette page et garde les mêmes ids que l'original (déplacement, pas
   * copie) — un seul commitDoc, et devient la nouvelle sélection de cette
   * page, comme pour un Coller cross-page déjà validé. Omise des
   * dépendances de useImperativeHandle pour la même raison que
   * `setIncomingSelectionPreview` ci-dessus. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  function receiveTransferredSelection(data: LassoClipboardData) {
    incomingPreviewRef.current = null;
    commitDoc({
      strokes: [...strokesRef.current, ...data.strokes],
      shapes: [...shapesRef.current, ...data.shapes],
      images: [...imagesRef.current, ...data.images],
      textBoxes: [...textBoxesRef.current, ...data.textBoxes],
    });
    setSelection({
      strokes: new Set(data.strokes.map((s) => s.id)),
      shapes: new Set(data.shapes.map((s) => s.id)),
      images: new Set(data.images.map((s) => s.id)),
      textBoxes: new Set(data.textBoxes.map((s) => s.id)),
    });
  }

  /** Insère une copie de `data` dans le document courant avec de nouveaux
   * ids et un léger décalage visuel, committe en une seule action Undo, et
   * en fait la nouvelle sélection — partagé par Dupliquer et Coller. */
  function insertClipboardData(data: LassoClipboardData) {
    const strokes = data.strokes.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      points: s.points.map((p) => ({ ...p, x: p.x + DUPLICATE_OFFSET, y: p.y + DUPLICATE_OFFSET })),
    }));
    const shapes = data.shapes.map((s) => ({ ...s, id: crypto.randomUUID(), x: s.x + DUPLICATE_OFFSET, y: s.y + DUPLICATE_OFFSET }));
    const images = data.images.map((img) => ({
      ...img,
      id: crypto.randomUUID(),
      x: img.x + DUPLICATE_OFFSET,
      y: img.y + DUPLICATE_OFFSET,
    }));
    const textBoxes = data.textBoxes.map((tb) => ({
      ...tb,
      id: crypto.randomUUID(),
      x: tb.x + DUPLICATE_OFFSET,
      y: tb.y + DUPLICATE_OFFSET,
    }));
    commitDoc({
      strokes: [...strokesRef.current, ...strokes],
      shapes: [...shapesRef.current, ...shapes],
      images: [...imagesRef.current, ...images],
      textBoxes: [...textBoxesRef.current, ...textBoxes],
    });
    setSelection({
      strokes: new Set(strokes.map((s) => s.id)),
      shapes: new Set(shapes.map((s) => s.id)),
      images: new Set(images.map((s) => s.id)),
      textBoxes: new Set(textBoxes.map((s) => s.id)),
    });
  }

  function handleSelectionCopy() {
    if (!selection) return;
    onClipboardChange?.(cloneSelected(selection));
  }

  function handleSelectionCut() {
    if (!selection) return;
    onClipboardChange?.(cloneSelected(selection));
    handleSelectionDelete();
  }

  function handleSelectionDuplicate() {
    if (!selection) return;
    insertClipboardData(cloneSelected(selection));
  }

  // Exposée telle quelle (pas de useCallback) via useImperativeHandle
  // (voir plus bas, qui la liste explicitement dans ses dépendances) :
  // n'est déclenchée que par un clic explicite sur "Coller", jamais un
  // chemin de rendu chaud — mémoïser toute la chaîne
  // (cloneSelected/insertClipboardData) pour ce seul appel n'apporterait
  // rien.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  function handleSelectionPaste() {
    if (!clipboard) return;
    insertClipboardData(clipboard);
  }

  /** Supprime tous les éléments sélectionnés en une seule action Undo. */
  function handleSelectionDelete() {
    if (!selection) return;
    commitDoc({
      strokes: strokesRef.current.filter((s) => !selection.strokes.has(s.id)),
      shapes: shapesRef.current.filter((s) => !selection.shapes.has(s.id)),
      images: imagesRef.current.filter((img) => !selection.images.has(img.id)),
      textBoxes: textBoxesRef.current.filter((tb) => !selection.textBoxes.has(tb.id)),
    });
    setSelection(null);
  }

  /** Outil "Déplacement" (main) : fait défiler la feuille au glisser, sans
   * jamais dessiner ni modifier le contenu — équivalent de l'outil main de
   * Photoshop / du mode scroll de Notability. */
  const panState = useRef<{
    startClientX: number;
    startClientY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  /** Doigt ≠ écriture : Stylo/Stylo bille/Crayon (tool "pen"), Surligneur
   * et Formes ne créent jamais de contenu au doigt — seul l'Apple Pencil
   * (pointerType "pen") dessine. Un doigt qui glisse pendant que l'un de
   * ces outils est actif fait défiler la page à la place, exactement comme
   * l'outil Déplacement — mais via cet état totalement séparé de
   * `panState` ci-dessus, pour ne modifier aucune ligne de son propre
   * mécanisme déjà validé (même formule de défilement, dupliquée
   * volontairement plutôt que partagée). */
  const touchScrollState = useRef<{
    startClientX: number;
    startClientY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);
  const touchDrawBlocked = tool === "pen" || tool === "highlighter" || tool === "shapes";

  /** AUDIT TEMPORAIRE — À RETIRER après diagnostic du trait Pencil perdu.
   * Trace le cycle pointerdown/pointermove/pointerup/pointercancel pour
   * confirmer/infirmer deux pistes : (A) touchScrollState/activePointerId
   * orphelins quand un pointerdown Pencil reprend la main sur un doigt déjà
   * actif, (B) annulation d'un trait classé "double-tap" (bascule Gomme).
   * Aucune logique fonctionnelle modifiée : uniquement des console.log. */
  const PEN_AUDIT = true;
  const auditLastLoggedStrokeId = useRef<string | null>(null);
  // Panneau visible temporaire (iPad, sans Safari Web Inspector) : les
  // lignes vivent dans ce ref (évite de recréer un tableau à chaque appel)
  // et auditLogTick force juste le re-rendu du panneau après chaque ajout.
  const auditLogRef = useRef<string[]>([]);
  const [auditLogTick, setAuditLogTick] = useState(0);
  const auditLogScrollRef = useRef<HTMLDivElement | null>(null);
  const auditAttemptsScrollRef = useRef<HTMLDivElement | null>(null);
  function penAuditLog(label: string, extra?: Record<string, unknown>) {
    if (!PEN_AUDIT) return;
    const payload = {
      activePointerId: activePointerId.current,
      hasCurrentStroke: !!currentStroke.current,
      hasTouchScrollState: !!touchScrollState.current,
      tool,
      ...extra,
    };
    console.log(`[PEN-AUDIT] ${label}`, payload);
    const time = new Date().toISOString().slice(11, 23);
    auditLogRef.current.push(`${time} ${label} ${JSON.stringify(payload)}`);
    if (auditLogRef.current.length > 500) {
      auditLogRef.current.splice(0, auditLogRef.current.length - 500);
    }
    setAuditLogTick((t) => t + 1);
  }

  /** AUDIT (round 4) : résumé compact d'un nœud DOM (tag/class/id), pour
   * inspecter la cible réelle d'un événement natif sans logguer l'objet
   * entier. `Window`/`Document` (bouts de composedPath()) ne sont pas des
   * `Element` et remontent `null` plutôt que de planter. */
  function describeElement(el: EventTarget | Element | null | undefined) {
    if (!el || !(el instanceof Element)) return null;
    return { tag: el.tagName, className: el.className || null, id: el.id || null };
  }

  /** AUDIT (round 2) : champs bruts de l'événement, pour distinguer un vrai
   * contact d'un survol Pencil (pressure/buttons/isPrimary notamment). */
  function pointerAuditFields(e: React.PointerEvent) {
    return {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      isPrimary: e.isPrimary,
      buttons: e.buttons,
      button: e.button,
      pressure: e.pressure,
      width: e.width,
      height: e.height,
    };
  }

  /** AUDIT (round 3) : une "tentative" = un contact Pencil physique, suivi
   * de son pointerdown natif jusqu'à son sort final (committed/discarded/
   * annulé). Indexé par pointerId côté down/up ; `penAttemptsByStroke` fait
   * le pont vers les logs de fin de endStroke(), qui eux ne connaissent que
   * le strokeId (pas l'événement pointeur d'origine). Rien ici ne déclenche
   * de re-rendu par lui-même : seul `moves` est incrémenté en pure mutation
   * de ref (jamais de setState par pointermove) ; tous les autres champs
   * sont modifiés juste à côté d'un penAuditLog déjà existant, qui
   * déclenche déjà le re-rendu du panneau — aucun setState supplémentaire
   * n'est ajouté. */
  type PenAttempt = {
    num: number;
    pointerId: number;
    strokeId: string | null;
    nativeDownAt: number | null;
    reactDownAt: number | null;
    accepted: boolean;
    started: boolean;
    moves: number;
    upAt: number | null;
    committed: boolean | null;
    cancelOrLost: boolean;
    notes: string[];
  };
  const penAttempts = useRef<Map<number, PenAttempt>>(new Map());
  const penAttemptsByStroke = useRef<Map<string, number>>(new Map());
  const penAttemptCounter = useRef(0);

  function getOrCreatePenAttempt(pointerId: number): PenAttempt {
    let attempt = penAttempts.current.get(pointerId);
    if (!attempt) {
      penAttemptCounter.current += 1;
      attempt = {
        num: penAttemptCounter.current,
        pointerId,
        strokeId: null,
        nativeDownAt: null,
        reactDownAt: null,
        accepted: false,
        started: false,
        moves: 0,
        upAt: null,
        committed: null,
        cancelOrLost: false,
        notes: [],
      };
      penAttempts.current.set(pointerId, attempt);
    }
    return attempt;
  }

  function markPenAttemptStarted(pointerId: number, strokeId: string) {
    const attempt = penAttempts.current.get(pointerId);
    if (attempt) {
      attempt.started = true;
      attempt.strokeId = strokeId;
    }
    penAttemptsByStroke.current.set(strokeId, pointerId);
  }

  function getPenAttemptByStrokeId(strokeId: string): PenAttempt | undefined {
    const pointerId = penAttemptsByStroke.current.get(strokeId);
    return pointerId !== undefined ? penAttempts.current.get(pointerId) : undefined;
  }

  function formatPenAttemptLine(a: PenAttempt): string {
    const nativeOk = a.nativeDownAt !== null;
    const reactOk = a.reactDownAt !== null;
    const delay = nativeOk && reactOk ? `+${a.reactDownAt! - a.nativeDownAt!}ms` : "—";
    const upOk = a.upAt !== null;
    const duration = reactOk && upOk ? `${a.upAt! - a.reactDownAt!}ms` : "—";
    const committedStr = a.committed === null ? "…" : a.committed ? "✓" : "✗";
    const parts = [
      `#${a.num}`,
      `native ${nativeOk ? "✓" : "✗"}`,
      `react ${reactOk ? "✓" : "✗"}`,
      delay,
      `accepted ${a.accepted ? "✓" : "✗"}`,
      `started ${a.started ? "✓" : "✗"}`,
      `moves ${a.moves}`,
      `up ${upOk ? "✓" : "✗"}`,
      duration,
      `committed ${committedStr}`,
      `cancel ${a.cancelOrLost ? "✓" : "✗"}`,
    ];
    if (a.notes.length > 0) parts.push(a.notes.join(", "));
    return parts.join(" | ");
  }

  /** AUDIT (round 2) : throttle par pointerId — le survol Pencil (pointerId
   * bas et stable, ex. 1) peut émettre des pointermove à haute fréquence ;
   * les logguer un par un floodait la console ET provoquait un re-rendu
   * React à chaque fois (setAuditLogTick), ce qui pouvait perturber la
   * mesure elle-même. On ne garde qu'un point toutes les 300ms par
   * pointerId, largement suffisant pour prouver la continuité du survol
   * pendant le "trou" sans polluer la trace. */
  const auditMoveThrottle = useRef<Map<number, number>>(new Map());
  function penAuditLogThrottled(pointerId: number, label: string, extra?: Record<string, unknown>) {
    if (!PEN_AUDIT) return;
    const now = Date.now();
    const last = auditMoveThrottle.current.get(pointerId) ?? 0;
    if (now - last < 300) return;
    auditMoveThrottle.current.set(pointerId, now);
    penAuditLog(label, extra);
  }

  useEffect(() => {
    if (!PEN_AUDIT) return;
    const el = auditLogScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    const attemptsEl = auditAttemptsScrollRef.current;
    if (attemptsEl) attemptsEl.scrollTop = attemptsEl.scrollHeight;
  }, [auditLogTick, PEN_AUDIT]);

  /** AUDIT round 2 — TEMPORAIRE : écoute native `pointerdown` en phase de
   * capture sur `document`, en plus (jamais à la place) des handlers React
   * du canvas. Purement observationnel — pas de preventDefault/
   * stopPropagation, ne modifie jamais le routage réel de l'événement.
   * Objectif unique : distinguer si un pointerdown Pencil existe quelque
   * part dans le DOM pendant le "trou" observé entre deux traits (cas A —
   * problème de routage vers React/canvas) ou s'il n'existe nulle part
   * avant l'apparition du prochain trait (cas B — rien à corriger côté
   * JS, limite native Safari/iPadOS). */
  useEffect(() => {
    if (!PEN_AUDIT) return;
    function handleNativePointerDownCapture(e: PointerEvent) {
      penAuditLog("NATIF(doc) pointerdown", {
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        isPrimary: e.isPrimary,
        buttons: e.buttons,
        button: e.button,
        pressure: e.pressure,
        width: e.width,
        height: e.height,
      });
      if (e.pointerType === "pen") {
        getOrCreatePenAttempt(e.pointerId).nativeDownAt = Date.now();
        // AUDIT (round 4) : routage DOM — où l'événement natif atterrit-il
        // réellement, et le canvas est-il bien sous le doigt/la pointe à cet
        // instant ? Lecture seule (getBoundingClientRect/elementFromPoint/
        // composedPath) : aucune capture, aucun pointer-events, rien de
        // fonctionnel n'est modifié ici.
        const canvasEl = canvasRef.current;
        const canvasRect = canvasEl?.getBoundingClientRect() ?? null;
        const insideCanvasRect = !!(
          canvasRect &&
          e.clientX >= canvasRect.left &&
          e.clientX <= canvasRect.right &&
          e.clientY >= canvasRect.top &&
          e.clientY <= canvasRect.bottom
        );
        penAuditLog("NATIF(doc) pointerdown routing", {
          pointerId: e.pointerId,
          target: describeElement(e.target),
          currentTarget: "document",
          composedPath: e.composedPath().slice(0, 8).map(describeElement),
          clientX: e.clientX,
          clientY: e.clientY,
          canvasRect: canvasRect
            ? {
                left: canvasRect.left,
                top: canvasRect.top,
                right: canvasRect.right,
                bottom: canvasRect.bottom,
                width: canvasRect.width,
                height: canvasRect.height,
              }
            : null,
          insideCanvasRect,
          elementAtPoint: describeElement(document.elementFromPoint(e.clientX, e.clientY)),
        });
      }
    }
    document.addEventListener("pointerdown", handleNativePointerDownCapture, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", handleNativePointerDownCapture, { capture: true });
    };
    // penAuditLog volontairement omis : sa nouvelle instance à chaque rendu
    // forcerait un détachement/rattachement du listener natif à chaque
    // rendu au lieu de seulement au changement d'outil — il ne lit que des
    // refs stables + `tool` (déjà dans les dépendances), donc son contenu
    // reste correct malgré l'identité de fonction non suivie ici.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [PEN_AUDIT, tool]);

  /** AUDIT (round 4) — TEMPORAIRE : listener natif posé directement sur le
   * nœud DOM du canvas (pas sur document), en phase de capture, uniquement
   * pour savoir si l'événement natif atteint bien CE nœud précis. Purement
   * observationnel : pas de preventDefault/stopPropagation, aucune capture
   * de pointeur posée ici, `pointer-events` non touché. Nettoyage explicite
   * au démontage/re-render pour ne jamais accumuler plusieurs listeners. */
  useEffect(() => {
    if (!PEN_AUDIT) return;
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    function handleCanvasNativePointerDownCapture(e: PointerEvent) {
      if (e.pointerType !== "pen") return;
      penAuditLog("NATIF(canvas) pointerdown", {
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    }
    canvasEl.addEventListener("pointerdown", handleCanvasNativePointerDownCapture, { capture: true, passive: true });
    return () => {
      canvasEl.removeEventListener("pointerdown", handleCanvasNativePointerDownCapture, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [PEN_AUDIT]);

  async function handleCopyAuditLog() {
    const summaryLines = Array.from(penAttempts.current.values()).map(formatPenAttemptLine);
    const text = [
      "=== Résumé par tentative ===",
      ...(summaryLines.length > 0 ? summaryLines : ["(aucune tentative)"]),
      "",
      "=== Log brut ===",
      ...auditLogRef.current,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API indisponible/refusée : rien d'autre à faire ici, le
      // panneau reste lisible et copiable manuellement à l'écran.
    }
  }

  function handleClearAuditLog() {
    auditLogRef.current = [];
    auditLastLoggedStrokeId.current = null;
    auditMoveThrottle.current.clear();
    penAttempts.current.clear();
    penAttemptsByStroke.current.clear();
    penAttemptCounter.current = 0;
    setAuditLogTick((t) => t + 1);
  }

  /** Récupère (en la mettant en cache) l'image HTML correspondant à une
   * source donnée — ne retourne l'image que si elle est déjà chargée ;
   * déclenche un nouveau rendu dès que le chargement se termine. */
  function getOrLoadImage(src: string): HTMLImageElement | null {
    const cached = imageCache.current.get(src);
    if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;
    const img = new Image();
    img.onload = () => scheduleRender();
    img.src = src;
    imageCache.current.set(src, img);
    return null;
  }

  const tapStartInfo = useRef<{ x: number; y: number; time: number } | null>(null);
  const tapIsCandidate = useRef(false);
  const lastTap = useRef<{ x: number; y: number; time: number } | null>(null);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdAnchorPos = useRef<{ x: number; y: number } | null>(null);
  const holdAnchorTime = useRef<number>(0);
  const lockedSnap = useRef<LockedSnap | null>(null);
  const snapAnimation = useRef<SnapAnimation | null>(null);

  const debugInfo = useRef({
    pointerType: "—",
    tool: "—",
    elapsedMs: 0,
    distanceFromAnchor: 0,
    lastResult: "—",
    holdCount: 0,
  });
  const [, setDebugTick] = useState(0);

  useEffect(() => {
    if (!debugHoldDetection) return;
    const id = setInterval(() => setDebugTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, [debugHoldDetection]);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    textBoxesRef.current = textBoxes;
  }, [textBoxes]);

  /** Autosauvegarde (voir onDocChange) : débounce le changement le plus
   * récent plutôt que d'appeler onDocChange à chaque frappe/trait — un
   * geste de dessin déclenche des dizaines de changements d'état en
   * quelques centaines de ms (voir commitDoc), inutile d'en faire autant
   * d'appels réseau. Ignore volontairement le tout premier rendu (via
   * isFirstRender) : sans ça, hydrater depuis initialDocument déclencherait
   * un aller-retour réseau qui réécrirait exactement ce qu'on vient de lire. */
  const isFirstDocRender = useRef(true);
  useEffect(() => {
    if (isFirstDocRender.current) {
      isFirstDocRender.current = false;
      return;
    }
    if (!onDocChange) return;
    const timer = setTimeout(() => {
      onDocChange({ strokes, shapes, images, textBoxes });
    }, 1000);
    return () => clearTimeout(timer);
  }, [strokes, shapes, images, textBoxes, onDocChange]);

  // Désélectionne le bloc de texte actif dès qu'on quitte l'outil "T" —
  // sinon son cadre de sélection et ses poignées resteraient visibles par-
  // dessus la feuille pendant qu'on dessine ou qu'on gomme avec un autre outil.
  useEffect(() => {
    if (tool !== "text") setSelectedTextBoxId(null);
  }, [tool]);

  const notifyHistory = useCallback(() => {
    onHistoryChange?.(undoStack.current.length > 0, redoStack.current.length > 0);
  }, [onHistoryChange]);

  const renderAll = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    drawSheetPattern(ctx, sheetType, PAGE_WIDTH, PAGE_HEIGHT, backgroundColor);
    const isDarkBg = isColorDark(backgroundColor);

    const selTransform = selectionTransform.current;
    for (const imageEl of imagesRef.current) {
      if (erasedImageIds.current?.has(imageEl.id)) continue;
      let preview = dragPreview.current?.id === imageEl.id ? dragPreview.current : imageEl;
      if (selTransform && selection?.images.has(imageEl.id)) {
        preview = applySelectionTransform(imageEl, selTransform, translateImage, scaleImage);
      }
      const img = getOrLoadImage(preview.src);
      if (img) drawImageElement(ctx, preview, img);
    }
    const strokesToRender = partialErasePreview.current ?? strokesRef.current;
    for (const stroke of strokesToRender) {
      if (erasedStrokeIds.current?.has(stroke.id)) continue;
      const display =
        selTransform && selection?.strokes.has(stroke.id)
          ? applySelectionTransform(stroke, selTransform, translateStroke, scaleStroke)
          : stroke;
      drawStroke(ctx, display, isDarkBg);
    }
    for (const shape of shapesRef.current) {
      if (erasedShapeIds.current?.has(shape.id)) continue;
      const display =
        selTransform && selection?.shapes.has(shape.id)
          ? applySelectionTransform(shape, selTransform, translateShape, scaleShape)
          : shape;
      drawShape(ctx, display);
    }

    if (snapAnimation.current) {
      const { startTime, fromPoints, toPoints } = snapAnimation.current;
      const t = Math.min(1, (performance.now() - startTime) / SNAP_ANIMATION_MS);
      const eased = easeOutCubic(t);
      const interpolated = fromPoints.map((p, i) => {
        const target = toPoints[i] ?? p;
        return {
          x: p.x + (target.x - p.x) * eased,
          y: p.y + (target.y - p.y) * eased,
          pressure: p.pressure,
        };
      });
      // Le résultat verrouillé (lockedSnap.current) est déjà posé avant
      // l'animation (voir scheduleHoldCheck) : on s'y réfère pour savoir si
      // c'est un redressement Stylo ou Surligneur, sans dupliquer l'info
      // dans snapAnimation.current.
      const animTarget = lockedSnap.current;
      drawStroke(
        ctx,
        animTarget && animTarget.tool === "highlighter"
          ? {
              id: "__snap-anim__",
              tool: "highlighter",
              color: animTarget.color,
              size: animTarget.size,
              opacity: highlighterOpacity,
              highlight: { mode: "freehand" },
              points: interpolated,
            }
          : {
              id: "__snap-anim__",
              tool: "pen",
              penType,
              color: penColor,
              size: penSize,
              points: interpolated,
            },
        isDarkBg,
      );
    } else if (lockedSnap.current) {
      // Forme verrouillée : le stylet n'ajuste plus que `current`, la
      // géométrie (ligne / rectangle / cercle) ne redevient jamais un tracé
      // à main levée.
      const locked = lockedSnap.current;
      if (locked.kind === "line") {
        drawStroke(
          ctx,
          locked.tool === "highlighter"
            ? {
                id: "__locked__",
                tool: "highlighter",
                color: locked.color,
                size: locked.size,
                opacity: highlighterOpacity,
                highlight: { mode: "freehand" },
                points: [
                  { x: locked.anchor.x, y: locked.anchor.y, pressure: 0.5 },
                  { x: locked.current.x, y: locked.current.y, pressure: 0.5 },
                ],
              }
            : {
                id: "__locked__",
                tool: "pen",
                penType: locked.penType ?? "fineliner",
                color: locked.color,
                size: locked.size,
                points: [
                  { x: locked.anchor.x, y: locked.anchor.y, pressure: 0.5 },
                  { x: locked.current.x, y: locked.current.y, pressure: 0.5 },
                ],
              },
          isDarkBg,
        );
      } else if (locked.shapeType) {
        drawShape(ctx, {
          id: "__locked__",
          type: locked.shapeType,
          x: locked.anchor.x,
          y: locked.anchor.y,
          width: locked.current.x - locked.anchor.x,
          height: locked.current.y - locked.anchor.y,
          color: locked.color,
          strokeWidth: locked.size,
        });
      }
    } else if (currentStroke.current) {
      drawStroke(ctx, currentStroke.current, isDarkBg);
    }

    if (currentShape.current) {
      drawShape(ctx, currentShape.current);
    }

    if ((tool === "photo" || tool === "pan") && selectedImageId) {
      const selected = imagesRef.current.find((img) => img.id === selectedImageId);
      const previewSelected = dragPreview.current?.id === selectedImageId ? dragPreview.current : selected;
      if (previewSelected) drawImageSelection(ctx, previewSelected);
    }

    if (tool === "lasso") {
      if (lassoPath.current.length > 1) {
        // Tracé temporaire du lasso — fin, semi-transparent, jamais dans
        // Document : purement un aperçu du geste en cours.
        ctx.save();
        ctx.strokeStyle = "rgba(31, 92, 74, 0.55)";
        ctx.fillStyle = "rgba(31, 92, 74, 0.08)";
        ctx.lineWidth = 1.25;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(lassoPath.current[0].x, lassoPath.current[0].y);
        for (let i = 1; i < lassoPath.current.length; i++) {
          ctx.lineTo(lassoPath.current[i].x, lassoPath.current[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (selection) {
        const raw = rawSelectionBounds(selection);
        if (raw) drawSelectionBoxAndHandles(ctx, displayBounds(raw));
      }
    }

    // Aperçu "fantôme" d'une sélection en cours de glisser DEPUIS une autre
    // page (drag cross-page du Lasso, voir CrossPageDragBridge) — déjà en
    // coordonnées locales à cette page, jamais dans strokesRef/shapesRef/
    // imagesRef ni dans Document. Les blocs de texte de l'aperçu sont gérés
    // à part (rendu DOM, voir incomingPreviewTextBoxes plus bas dans le JSX).
    if (incomingPreviewRef.current) {
      const preview = incomingPreviewRef.current;
      for (const imageEl of preview.images) {
        const img = getOrLoadImage(imageEl.src);
        if (img) drawImageElement(ctx, imageEl, img);
      }
      for (const stroke of preview.strokes) drawStroke(ctx, stroke, isDarkBg);
      for (const shape of preview.shapes) drawShape(ctx, shape);
      let bounds: Bounds | null = null;
      for (const s of preview.strokes) bounds = bounds ? unionBounds(bounds, strokeBounds(s)) : strokeBounds(s);
      for (const s of preview.shapes) bounds = bounds ? unionBounds(bounds, boxBounds(s)) : boxBounds(s);
      for (const img of preview.images) bounds = bounds ? unionBounds(bounds, boxBounds(img)) : boxBounds(img);
      for (const tb of preview.textBoxes) {
        const b = textBoxBounds(tb, MIN_TEXTBOX_HIT_HEIGHT);
        bounds = bounds ? unionBounds(bounds, b) : b;
      }
      if (bounds) drawSelectionBoxAndHandles(ctx, bounds);
    }

    if (tool === "eraser" && hoverEraserPos.current) {
      // Le contour de la zone d'effacement reste visible dans tous les
      // modes (Précise/Trait entier/Surlignage) — pas seulement en mode
      // Partielle : sans lui, survoler une zone vide en mode Totale
      // n'affichait auparavant aucun indice visuel du tout.
      drawEraserCirclePreview(ctx, hoverEraserPos.current, eraserRadius);
      if (eraserMode === "whole") {
        const hovered = hoveredStrokeId.current
          ? strokesToRender.find((s) => s.id === hoveredStrokeId.current)
          : undefined;
        if (hovered) drawStrokeEraseHighlight(ctx, hovered);
      }
    }
    // getOrLoadImage volontairement omis des dépendances : il appelle
    // scheduleRender, défini juste après renderAll (référence circulaire),
    // mais ne dépend lui-même que de refs stables (imageCache) donc son
    // identité entre deux rendus n'a aucune incidence sur le comportement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    backgroundColor,
    sheetType,
    PAGE_WIDTH,
    PAGE_HEIGHT,
    penColor,
    penSize,
    penType,
    tool,
    selectedImageId,
    eraserMode,
    eraserRadius,
    selection,
  ]);

  const scheduleRender = useCallback(() => {
    if (renderScheduled.current) return;
    renderScheduled.current = true;
    requestAnimationFrame(() => {
      renderScheduled.current = false;
      renderAll();
    });
  }, [renderAll]);

  // Efface l'aperçu au survol de la Gomme dès qu'on change d'outil — sinon
  // il resterait affiché par-dessus la feuille avec un autre outil actif.
  useEffect(() => {
    if (tool !== "eraser") {
      hoverEraserPos.current = null;
      hoveredStrokeId.current = null;
      scheduleRender();
    }
  }, [tool, scheduleRender]);

  /** Anime la transition entre le tracé à main levée et la forme propre
   * détectée : chaque point migre en douceur vers sa cible plutôt que de se
   * remplacer d'un coup. */
  function runSnapAnimation() {
    if (!snapAnimation.current) return;
    const elapsed = performance.now() - snapAnimation.current.startTime;
    scheduleRender();
    if (elapsed < SNAP_ANIMATION_MS) {
      requestAnimationFrame(runSnapAnimation);
    } else {
      snapAnimation.current = null;
      scheduleRender();
    }
  }

  function startSnapAnimation(fromPoints: StrokePoint[], result: NonNullable<ShapeDetectionResult>) {
    if (fromPoints.length === 0) return;
    snapAnimation.current = {
      startTime: performance.now(),
      fromPoints: fromPoints.map((p) => ({ ...p })),
      toPoints: computeSnapTargets(fromPoints, result),
    };
    requestAnimationFrame(runSnapAnimation);
  }

  /** (Ré)arme le minuteur de maintien, ancré sur `pos`. Tant que le stylet
   * reste dans le rayon de tolérance de gigue autour de cet ancrage, le
   * minuteur n'est jamais réinitialisé — c'est ce qui lui permet de survivre
   * jusqu'à `holdToSnapMs` en conditions réelles.
   *
   * On fige aussi un instantané des points du tracé à cet instant : les
   * points ajoutés ensuite pendant l'attente (gigue du capteur pendant le
   * maintien, souvent des dizaines de points quasi identiques) ne doivent
   * pas fausser l'analyse de forme — sans quoi un cercle bien rond peut se
   * faire mal classer à cause d'un amas de points parasites concentré à un
   * seul endroit de son contour. */
  function scheduleHoldCheck(pos: { x: number; y: number }, forTool: InkTool) {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdAnchorPos.current = pos;
    holdAnchorTime.current = performance.now();
    const snapshotPoints = currentStroke.current ? currentStroke.current.points.slice() : [];
    holdTimer.current = setTimeout(() => {
      if (debugHoldDetection) debugInfo.current.holdCount += 1;
      if (snapshotPoints.length === 0) return;
      const result = detectFreehandShape(snapshotPoints);
      if (debugHoldDetection) {
        debugInfo.current.lastResult = result
          ? result.kind === "shape"
            ? `shape:${result.shape.type}`
            : "line"
          : "aucun (tracé non reconnu)";
      }
      if (!result) return;
      if (forTool === "highlighter") {
        // Le Surligneur ne se redresse qu'en ligne droite — un résultat
        // "shape" (cercle/rectangle) est ignoré : un surlignage ne devient
        // jamais une forme géométrique, contrairement au Stylo.
        if (result.kind !== "line") return;
        const [start, end] = result.points;
        lockedSnap.current = {
          kind: "line",
          tool: "highlighter",
          anchor: { x: start.x, y: start.y },
          current: { x: end.x, y: end.y },
          color: highlighterColor,
          size: highlighterSize,
        };
        startSnapAnimation(snapshotPoints, result);
        return;
      }
      lockedSnap.current = deriveLockedSnap(result, snapshotPoints[0] ?? pos, penColor, penSize, penType);
      startSnapAnimation(snapshotPoints, result);
    }, holdToSnapMs);
  }

  // Prépare le canvas (résolution physique = résolution logique * devicePixelRatio).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = PAGE_WIDTH * dpr;
    canvas.height = PAGE_HEIGHT * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctxRef.current = ctx;
    renderAll();
  }, [renderAll, PAGE_WIDTH, PAGE_HEIGHT]);

  useEffect(() => {
    scheduleRender();
  }, [strokes, shapes, images, backgroundColor, scheduleRender]);

  // Empêche le geste natif de pinch-to-zoom du navigateur/Safari sur le
  // canvas (déjà largement neutralisé par touchAction: "none") tout en
  // écoutant le zoom au trackpad (molette + Ctrl), qui doit rester possible
  // même avec touch-action désactivé — d'où un listener natif non passif
  // plutôt que la prop React onWheel (dont le comportement passif par
  // défaut empêcherait preventDefault de fonctionner de façon fiable).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      onPinchZoom(zoom - e.deltaY * 0.01, e.clientX, e.clientY);
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [zoom, onPinchZoom]);

  const commitDoc = useCallback(
    (next: Document) => {
      undoStack.current.push({
        strokes: strokesRef.current,
        shapes: shapesRef.current,
        images: imagesRef.current,
        textBoxes: textBoxesRef.current,
      });
      redoStack.current = [];
      strokesRef.current = next.strokes;
      shapesRef.current = next.shapes;
      imagesRef.current = next.images;
      textBoxesRef.current = next.textBoxes;
      setStrokes(next.strokes);
      setShapes(next.shapes);
      setImages(next.images);
      setTextBoxes(next.textBoxes);
      notifyHistory();
    },
    [notifyHistory],
  );

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    redoStack.current.push({
      strokes: strokesRef.current,
      shapes: shapesRef.current,
      images: imagesRef.current,
      textBoxes: textBoxesRef.current,
    });
    strokesRef.current = prev.strokes;
    shapesRef.current = prev.shapes;
    imagesRef.current = prev.images;
    textBoxesRef.current = prev.textBoxes;
    setStrokes(prev.strokes);
    setShapes(prev.shapes);
    setImages(prev.images);
    setTextBoxes(prev.textBoxes);
    notifyHistory();
  }, [notifyHistory]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push({
      strokes: strokesRef.current,
      shapes: shapesRef.current,
      images: imagesRef.current,
      textBoxes: textBoxesRef.current,
    });
    strokesRef.current = next.strokes;
    shapesRef.current = next.shapes;
    imagesRef.current = next.images;
    textBoxesRef.current = next.textBoxes;
    setStrokes(next.strokes);
    setShapes(next.shapes);
    setImages(next.images);
    setTextBoxes(next.textBoxes);
    notifyHistory();
  }, [notifyHistory]);

  /** Importe une ou plusieurs photos depuis la galerie sur la feuille : lues
   * en data URL, dimensionnées pour tenir dans la page (échelle réduite si
   * besoin, jamais agrandie au-delà de la taille d'origine), et disposées en
   * cascade légère si plusieurs photos sont importées d'un coup. */
  const importPhotos = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (fileArray.length === 0) return;

      const newImages: ImageElement[] = [];
      const maxW = PAGE_WIDTH * 0.45;
      const maxH = PAGE_HEIGHT * 0.35;

      for (let i = 0; i < fileArray.length; i++) {
        try {
          const src = await readFileAsDataURL(fileArray[i]);
          const natural = await loadImageDimensions(src);
          const scale = Math.min(1, maxW / natural.width, maxH / natural.height);
          const width = natural.width * scale;
          const height = natural.height * scale;
          const offset = (newImages.length + imagesRef.current.length) * 24;
          newImages.push({
            id: crypto.randomUUID(),
            x: clamp(PAGE_WIDTH / 2 - width / 2 + offset, 0, Math.max(0, PAGE_WIDTH - width)),
            y: clamp(PAGE_HEIGHT / 2 - height / 2 + offset, 0, Math.max(0, PAGE_HEIGHT - height)),
            width,
            height,
            src,
          });
        } catch {
          // Fichier illisible ou corrompu : on l'ignore et on continue avec les autres.
        }
      }

      if (newImages.length === 0) return;
      const nextImages = [...imagesRef.current, ...newImages];
      commitDoc({
        strokes: strokesRef.current,
        shapes: shapesRef.current,
        images: nextImages,
        textBoxes: textBoxesRef.current,
      });
      setSelectedImageId(newImages[newImages.length - 1].id);
    },
    [PAGE_WIDTH, PAGE_HEIGHT, commitDoc],
  );

  // handleSelectionPaste n'est pas mémoïsée (useCallback) : elle ferme sur
  // `clipboard`, qui change au fil des Copier/Couper sur n'importe quelle
  // page (voir NotesPageClient) — l'omettre des dépendances laisserait
  // `paste` capturer un presse-papiers périmé tant qu'aucune des autres
  // dépendances ne change (voir aussi le commentaire sur sa définition).
  useImperativeHandle(
    ref,
    () => ({
      undo,
      redo,
      importPhotos,
      paste: handleSelectionPaste,
      setIncomingSelectionPreview,
      receiveTransferredSelection,
    }),
    [undo, redo, importPhotos, handleSelectionPaste, setIncomingSelectionPreview, receiveTransferredSelection],
  );

  function getPos(e: React.PointerEvent<HTMLCanvasElement>): StrokePoint {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = PAGE_WIDTH / rect.width;
    const scaleY = PAGE_HEIGHT / rect.height;
    // tiltX/tiltY (degrés, -90 à 90) ne sont fournis que par un stylet
    // (Apple Pencil) ; 0 pour souris/doigt, d'où la magnitude à 0 dans ce cas
    // — le Crayon (seul outil qui la lit) affiche alors un trait vertical.
    const tiltMagnitude = Math.min(1, Math.hypot(e.tiltX || 0, e.tiltY || 0) / 90);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
      tilt: tiltMagnitude,
    };
  }

  /** Recalcule `ruler` à partir de `rulerGestureStart` et des positions
   * écran actuelles des doigts qui la manipulent — 1 doigt = translation
   * directe, 2 doigts = rotation autour du centre actuel (position figée
   * pendant la phase à 2 doigts, voir `endRulerTouch` pour la reprise en
   * douceur au retour à 1 doigt). L'angle utilise directement les
   * coordonnées écran (clientX/clientY) : un delta d'angle entre deux
   * vecteurs est déjà invariant à l'échelle, pas besoin de conversion
   * écran→document ici (contrairement à la translation, qui doit l'être). */
  function updateRulerFromGesture() {
    const start = rulerGestureStart.current;
    const canvas = canvasRef.current;
    if (!start || !canvas) return;
    const ids = rulerTouchIds.current;

    if (ids.length === 1) {
      const id = ids[0];
      const startClient = start.touches.get(id);
      const nowClient = rulerLiveClientPos.current.get(id);
      if (!startClient || !nowClient) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = PAGE_WIDTH / rect.width;
      const scaleY = PAGE_HEIGHT / rect.height;
      const dx = (nowClient.x - startClient.x) * scaleX;
      const dy = (nowClient.y - startClient.y) * scaleY;
      setRuler({ ...start.ruler, x: start.ruler.x + dx, y: start.ruler.y + dy });
    } else if (ids.length === 2) {
      const [id1, id2] = ids;
      const s1 = start.touches.get(id1);
      const s2 = start.touches.get(id2);
      const n1 = rulerLiveClientPos.current.get(id1);
      const n2 = rulerLiveClientPos.current.get(id2);
      if (!s1 || !s2 || !n1 || !n2) return;
      const startAngle = Math.atan2(s2.y - s1.y, s2.x - s1.x);
      const nowAngle = Math.atan2(n2.y - n1.y, n2.x - n1.x);
      const deltaDeg = ((nowAngle - startAngle) * 180) / Math.PI;
      setRuler({ ...start.ruler, angleDeg: snapAngle(start.ruler.angleDeg + deltaDeg) });
    }
  }

  /** Retire `pointerId` du geste de manipulation de la règle en cours, s'il
   * y participait — renvoie faux sinon (rien à faire, geste normal). Passer
   * de 2 à 1 doigt reprend une translation depuis une base fraîche (pas de
   * saut) plutôt que de simplement arrêter le geste. */
  function endRulerTouch(pointerId: number): boolean {
    if (!rulerTouchIds.current.includes(pointerId)) return false;
    rulerTouchIds.current = rulerTouchIds.current.filter((id) => id !== pointerId);
    rulerLiveClientPos.current.delete(pointerId);
    if (rulerTouchIds.current.length === 0) {
      rulerGestureStart.current = null;
      setRulerRotating(false);
    } else if (ruler) {
      const remainingId = rulerTouchIds.current[0];
      const remainingClient = rulerLiveClientPos.current.get(remainingId);
      rulerGestureStart.current = remainingClient
        ? { ruler: { ...ruler }, touches: new Map([[remainingId, remainingClient]]) }
        : null;
      setRulerRotating(false);
    }
    return true;
  }

  /** Tente de sélectionner une image existante (ou une de ses poignées de
   * redimensionnement) à la position donnée, et amorce son déplacement ou
   * redimensionnement le cas échéant. Factorisée pour être appelée aussi
   * bien par l'outil "Photo" que par l'outil "Déplacement" : ce dernier
   * doit pouvoir manipuler une photo déjà en place (cliquer dessus la
   * sélectionne/la déplace) sans redémarrer un défilement de page dans ce
   * cas précis — sinon, aucun outil autre que "Photo" ne permettait de
   * ressaisir une image après avoir dessiné dessus. Renvoie `true` si une
   * image a effectivement été touchée. */
  function tryStartImageInteraction(pos: StrokePoint): boolean {
    const list = imagesRef.current;

    if (selectedImageId) {
      const selected = list.find((img) => img.id === selectedImageId);
      if (selected) {
        const handle = imageHandleHitTest(selected, pos.x, pos.y);
        if (handle) {
          imageDragMode.current = {
            id: selected.id,
            mode: handle,
            startPos: { x: pos.x, y: pos.y },
            startElement: { ...selected },
          };
          return true;
        }
      }
    }

    for (let i = list.length - 1; i >= 0; i--) {
      if (imageHitTest(list[i], pos.x, pos.y, 4)) {
        setSelectedImageId(list[i].id);
        imageDragMode.current = {
          id: list[i].id,
          mode: "move",
          startPos: { x: pos.x, y: pos.y },
          startElement: { ...list[i] },
        };
        return true;
      }
    }

    setSelectedImageId(null);
    imageDragMode.current = null;
    return false;
  }

  /** Met à jour l'aperçu de déplacement/redimensionnement d'une image dont
   * l'interaction a été amorcée par tryStartImageInteraction — partagée par
   * les outils "Photo" et "Déplacement" pour la même raison. Renvoie
   * `true` si une interaction était bien en cours (donc gérée ici). */
  function updateImageInteractionPreview(pos: StrokePoint): boolean {
    if (!imageDragMode.current) return false;
    const { id, mode, startPos, startElement } = imageDragMode.current;
    const dx = pos.x - startPos.x;
    const dy = pos.y - startPos.y;

    let next: ImageElement;
    if (mode === "move") {
      next = { ...startElement, x: startElement.x + dx, y: startElement.y + dy };
    } else {
      const x1 = startElement.x + startElement.width;
      const y1 = startElement.y + startElement.height;
      let { x, y, width, height } = startElement;
      if (mode === "nw") {
        x = startElement.x + dx;
        y = startElement.y + dy;
        width = x1 - x;
        height = y1 - y;
      } else if (mode === "ne") {
        y = startElement.y + dy;
        width = startElement.width + dx;
        height = y1 - y;
      } else if (mode === "sw") {
        x = startElement.x + dx;
        width = x1 - x;
        height = startElement.height + dy;
      } else if (mode === "se") {
        width = startElement.width + dx;
        height = startElement.height + dy;
      }
      next = { ...startElement, x, y, width: Math.max(20, width), height: Math.max(20, height) };
    }

    // On ne touche pas encore imagesRef.current ici (voir dragPreview) :
    // seul le commit final au relâchement doit modifier la référence, sans
    // quoi l'instantané "avant" de l'annulation serait déjà pollué par le
    // déplacement en cours (même bug que l'ancienne gomme).
    dragPreview.current = { ...next, id };
    scheduleRender();
    return true;
  }

  /** Termine une éventuelle interaction avec une image en cours
   * (déplacement/redimensionnement amorcé par tryStartImageInteraction) et
   * committe le résultat. Renvoie `true` si une interaction était bien en
   * cours (donc gérée ici) — partagée par les outils "Photo" et
   * "Déplacement". */
  function commitImageInteraction(): boolean {
    if (!imageDragMode.current) return false;
    const preview = dragPreview.current;
    imageDragMode.current = null;
    dragPreview.current = null;
    if (preview) {
      const nextImages = imagesRef.current.map((img) => (img.id === preview.id ? preview : img));
      commitDoc({
        strokes: strokesRef.current,
        shapes: shapesRef.current,
        images: nextImages,
        textBoxes: textBoxesRef.current,
      });
    }
    return true;
  }

  /** Met à jour l'aperçu au survol de la Gomme (position + trait éventuel-
   * lement surligné en mode Totale) — appelée aussi bien par un simple
   * survol (handlePointerMove, pointeur relâché) que pendant un geste
   * d'effacement actif (handlePointerDown/handlePointerMove, pointeur
   * enfoncé), pour que le cercle en mode Partielle continue de suivre le
   * curseur pendant qu'on efface et pas seulement avant de toucher la page. */
  function updateEraserHoverPreview(pos: StrokePoint) {
    hoverEraserPos.current = pos;
    hoveredStrokeId.current =
      eraserMode === "whole"
        ? (strokesRef.current.find(
            (s) => (eraserTarget === "all" || s.tool === "highlighter") && strokeHitTest(s, pos.x, pos.y, eraserRadius),
          )?.id ?? null)
        : null;
  }

  /** Découpe les traits touchés par le cercle de gomme au lieu de les
   * effacer en entier (mode "partial"). Comme eraseAt, ne mute jamais
   * strokesRef.current directement : le résultat "en cours" vit dans
   * partialErasePreview.current jusqu'au commit final (endStroke), pour ne
   * pas casser le snapshot d'annulation — voir le commentaire au-dessus. */
  function erasePartialAt(pos: StrokePoint): boolean {
    const source = partialErasePreview.current ?? strokesRef.current;
    let changed = false;
    const next: Stroke[] = [];
    for (const stroke of source) {
      if (eraserTarget === "highlighter" && stroke.tool !== "highlighter") {
        next.push(stroke);
        continue;
      }
      const pieces = partialEraseStroke(stroke, pos.x, pos.y, eraserRadius);
      if (!(pieces.length === 1 && pieces[0] === stroke)) changed = true;
      next.push(...pieces);
    }
    if (changed) {
      partialErasePreview.current = next;
    }
    return changed;
  }

  function eraseAt(pos: StrokePoint) {
    if (!erasedStrokeIds.current || !erasedShapeIds.current || !erasedImageIds.current || !erasedTextBoxIds.current) {
      return;
    }
    let changed = false;
    if (eraserMode === "partial") {
      changed = erasePartialAt(pos) || changed;
    } else {
      for (const stroke of strokesRef.current) {
        if (erasedStrokeIds.current.has(stroke.id)) continue;
        if (eraserTarget === "highlighter" && stroke.tool !== "highlighter") continue;
        if (strokeHitTest(stroke, pos.x, pos.y, eraserRadius)) {
          erasedStrokeIds.current.add(stroke.id);
          changed = true;
        }
      }
    }
    // La gomme ciblée "Surlignage" ne touche jamais les formes/photos/textes
    // (seuls les traits de surlignage, gérés ci-dessus, sont candidats).
    if (eraserTarget !== "all") {
      if (changed) scheduleRender();
      return;
    }
    for (const shape of shapesRef.current) {
      if (erasedShapeIds.current.has(shape.id)) continue;
      if (shapeHitTest(shape, pos.x, pos.y, eraserRadius)) {
        erasedShapeIds.current.add(shape.id);
        changed = true;
      }
    }
    for (const imageEl of imagesRef.current) {
      if (erasedImageIds.current.has(imageEl.id)) continue;
      if (imageHitTest(imageEl, pos.x, pos.y, eraserRadius)) {
        erasedImageIds.current.add(imageEl.id);
        changed = true;
      }
    }
    for (const textBox of textBoxesRef.current) {
      if (erasedTextBoxIds.current.has(textBox.id)) continue;
      const height = textBoxHeights.current.get(textBox.id) ?? MIN_TEXTBOX_HIT_HEIGHT;
      if (textBoxHitTest(textBox, height, pos.x, pos.y, eraserRadius)) {
        erasedTextBoxIds.current.add(textBox.id);
        changed = true;
      }
    }
    // On ne retire les éléments effacés de strokesRef/shapesRef/imagesRef/
    // textBoxesRef qu'au commit final (endStroke) — pas ici — afin que ces
    // refs conservent l'état "avant effacement" jusque-là : commitDoc s'en
    // sert pour construire l'instantané que l'annulation doit restaurer. Le
    // rendu masque déjà les éléments dessinés sur le canvas qui sont
    // marqués comme effacés (voir renderAll) ; les blocs de texte (rendus en
    // DOM, pas sur le canvas) ne disparaissent visuellement qu'au commit —
    // simplification acceptée pour ne pas dupliquer cet état côté React.
    if (changed) {
      scheduleRender();
    }
  }

  /** Efface le long du segment `from`→`to` plutôt qu'au seul point `to` — un
   * `pointermove` isolé ne teste que la position courante ; entre deux
   * événements consécutifs d'un geste rapide, le pointeur peut avoir
   * parcouru une distance supérieure au rayon de la gomme, laissant un petit
   * trait entièrement "enjambé" sans qu'aucun point ne tombe dedans. Pas
   * pour le tout premier point d'un geste (`from` null) : rien à interpoler. */
  function eraseAlongPath(from: { x: number; y: number } | null, to: StrokePoint) {
    if (!from) {
      eraseAt(to);
      return;
    }
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const step = Math.max(2, eraserRadius * 0.5);
    const steps = Math.min(40, Math.max(1, Math.ceil(dist / step)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      eraseAt({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        pressure: to.pressure,
        tilt: to.tilt,
      });
    }
  }

  function handleTextBoxSelect(id: string) {
    setSelectedTextBoxId(id);
  }

  /** Appelé quand un bloc de texte perd le focus (fin d'édition) — seul
   * moment où son contenu est réellement commité dans l'historique
   * annuler/rétablir, comme un trait n'est commité qu'au lever du stylet.
   * Un bloc resté vide (jamais commité, ou vidé de tout son texte) est
   * retiré plutôt que conservé.
   *
   * Ce blur n'implique pas forcément que l'utilisateur a fini d'interagir
   * avec le bloc : certains contrôles de la barre riche (champ URL du lien,
   * saisie numérique de taille, sélecteur de couleur natif) font perdre le
   * focus DOM à l'éditeur sans que ce soit une vraie désélection. On ne
   * désélectionne donc le bloc ici que s'il est effectivement supprimé
   * (resté/devenu vide) — sinon la sélection reste active et la barre riche
   * réapparaît dès que l'éditeur reprend le focus. */
  function handleTextBoxCommit(id: string, html: string, isEmpty: boolean) {
    const draft = draftTextBoxes.find((t) => t.id === id);
    if (draft) {
      setDraftTextBoxes((prev) => prev.filter((t) => t.id !== id));
      if (!isEmpty) {
        commitDoc({
          strokes: strokesRef.current,
          shapes: shapesRef.current,
          images: imagesRef.current,
          textBoxes: [...textBoxesRef.current, { ...draft, html }],
        });
      } else if (selectedTextBoxId === id) {
        setSelectedTextBoxId(null);
      }
      return;
    }

    const existing = textBoxesRef.current.find((t) => t.id === id);
    if (!existing) return;
    if (isEmpty) {
      commitDoc({
        strokes: strokesRef.current,
        shapes: shapesRef.current,
        images: imagesRef.current,
        textBoxes: textBoxesRef.current.filter((t) => t.id !== id),
      });
      if (selectedTextBoxId === id) setSelectedTextBoxId(null);
    } else if (existing.html !== html) {
      commitDoc({
        strokes: strokesRef.current,
        shapes: shapesRef.current,
        images: imagesRef.current,
        textBoxes: textBoxesRef.current.map((t) => (t.id === id ? { ...t, html } : t)),
      });
    }
  }

  function handleTextBoxMoveEnd(id: string, x: number, y: number) {
    const draft = draftTextBoxes.find((t) => t.id === id);
    if (draft) {
      // Filet de sécurité (le glisser en direct dans TextBoxOverlay clampe
      // déjà) : ne doit jamais dépasser horizontalement les limites de la page.
      const clampedX = Math.min(Math.max(0, x), Math.max(0, PAGE_WIDTH - draft.width));
      setDraftTextBoxes((prev) => prev.map((t) => (t.id === id ? { ...t, x: clampedX, y } : t)));
      return;
    }
    const existing = textBoxesRef.current.find((t) => t.id === id);
    if (!existing) return;
    const clampedX = Math.min(Math.max(0, x), Math.max(0, PAGE_WIDTH - existing.width));
    if (existing.x === clampedX && existing.y === y) return;
    commitDoc({
      strokes: strokesRef.current,
      shapes: shapesRef.current,
      images: imagesRef.current,
      textBoxes: textBoxesRef.current.map((t) => (t.id === id ? { ...t, x: clampedX, y } : t)),
    });
  }

  function handleTextBoxResizeEnd(id: string, width: number) {
    const draft = draftTextBoxes.find((t) => t.id === id);
    if (draft) {
      // Filet de sécurité (le glisser en direct dans TextBoxOverlay clampe
      // déjà) : la largeur maximale reste bornée par l'espace à droite de x.
      const clampedWidth = Math.min(width, Math.max(1, PAGE_WIDTH - draft.x));
      setDraftTextBoxes((prev) => prev.map((t) => (t.id === id ? { ...t, width: clampedWidth } : t)));
      return;
    }
    const existing = textBoxesRef.current.find((t) => t.id === id);
    if (!existing) return;
    const clampedWidth = Math.min(width, Math.max(1, PAGE_WIDTH - existing.x));
    if (existing.width === clampedWidth) return;
    commitDoc({
      strokes: strokesRef.current,
      shapes: shapesRef.current,
      images: imagesRef.current,
      textBoxes: textBoxesRef.current.map((t) => (t.id === id ? { ...t, width: clampedWidth } : t)),
    });
  }

  function handleTextBoxHeightChange(id: string, height: number) {
    textBoxHeights.current.set(id, height);
  }

  /** Suppression explicite d'un bloc entier depuis l'outil Texte (icône
   * Corbeille de TextBoxOverlay) — distinct de la suppression automatique
   * d'un bloc resté vide (voir handleTextBoxCommit). Même branchement
   * brouillon/réel que le reste des actions sur un bloc : un brouillon
   * jamais sauvegardé se retire sans Undo, un bloc réel part par un seul
   * commitDoc (donc un seul Undo, qui le restaure). */
  function handleTextBoxDelete(id: string) {
    if (selectedTextBoxId === id) setSelectedTextBoxId(null);
    const draft = draftTextBoxes.find((t) => t.id === id);
    if (draft) {
      setDraftTextBoxes((prev) => prev.filter((t) => t.id !== id));
      return;
    }
    if (!textBoxesRef.current.some((t) => t.id === id)) return;
    commitDoc({
      strokes: strokesRef.current,
      shapes: shapesRef.current,
      images: imagesRef.current,
      textBoxes: textBoxesRef.current.filter((t) => t.id !== id),
    });
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    penAuditLog(`${e.pointerType.toUpperCase()} DOWN entry`, pointerAuditFields(e));
    if (PEN_AUDIT && e.pointerType === "pen") {
      const attempt = getOrCreatePenAttempt(e.pointerId);
      if (attempt.reactDownAt === null) attempt.reactDownAt = Date.now();
    }
    if (e.pointerType === "touch") {
      // Doigt sur le corps de la règle : démarre/rejoint son geste de
      // déplacement (1 doigt) ou de rotation (2e doigt) — jamais le
      // pincement-zoom, même si un 2e doigt touche par ailleurs (voir plus
      // bas, la vérification classique de `touchPoints`/`pinchState` n'est
      // atteinte que pour un contact qui n'est PAS sur la règle).
      if (rulerActive && ruler && rulerTouchIds.current.length < 2) {
        const docPos = getPos(e);
        if (isPointOnRuler(ruler, docPos.x, docPos.y)) {
          rulerTouchIds.current = [...rulerTouchIds.current, e.pointerId];
          rulerLiveClientPos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          rulerGestureStart.current = { ruler: { ...ruler }, touches: new Map(rulerLiveClientPos.current) };
          setRulerRotating(rulerTouchIds.current.length === 2);
          scheduleRender();
          penAuditLog("TOUCH DOWN return: ruler-touch-claim", { pointerId: e.pointerId });
          return;
        }
      }
      touchPoints.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchPoints.current.size >= 2) {
        // Geste de pincement à deux doigts : on interrompt tout tracé en
        // cours et on bascule en mode zoom, quel que soit l'outil actif —
        // ce geste doit rester possible même pendant l'écriture au stylet.
        if (activePointerId.current !== null) {
          try {
            e.currentTarget.releasePointerCapture(activePointerId.current);
          } catch {
            // Capture absente en environnement de test synthétique — sans conséquence.
          }
        }
        currentStroke.current = null;
        currentShape.current = null;
        shapeStartPos.current = null;
        lockedSnap.current = null;
        snapAnimation.current = null;
        holdAnchorPos.current = null;
        rulerStrokeEdge.current = null;
        imageDragMode.current = null;
        dragPreview.current = null;
        selectionDragMode.current = null;
        selectionTransform.current = null;
        panState.current = null;
        setIsPanning(false);
        if (holdTimer.current) {
          clearTimeout(holdTimer.current);
          holdTimer.current = null;
        }
        activePointerId.current = null;
        const pts = Array.from(touchPoints.current.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        pinchState.current = { initialDistance: dist || 1, initialZoom: zoom };
        scheduleRender();
        penAuditLog("TOUCH DOWN return: pinch-start", { pointerId: e.pointerId });
        return;
      }
    }

    if (tool !== "pan" && e.pointerType === "touch" && Date.now() - lastPenTime.current < PALM_REJECTION_MS) {
      // Rejet de paume : on ignore ce contact tactile pendant l'écriture au
      // stylet — sauf avec l'outil Déplacement, explicitement choisi pour
      // naviguer et qui ne dessine jamais rien. Couvre aussi
      // touchDrawBlocked (Stylo/Surligneur/Formes) : sans cette garde, une
      // paume posée pendant l'écriture Pencil vole activePointerId/pointer
      // capture au Pencil en cours de trait (voir handlePointerDown
      // quelques lignes plus bas, capture commune à tout pointerType qui
      // franchit cette garde) — ce n'est pas seulement "empêcher un trait
      // accidentel au doigt", structurellement déjà exclu ailleurs.
      penAuditLog("TOUCH DOWN return: palm-rejection", { pointerId: e.pointerId });
      return;
    }
    if (e.pointerType === "pen") {
      lastPenTime.current = Date.now();
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Certains environnements (tests automatisés, pointeurs synthétiques)
      // n'ont pas de pointeur actif à capturer — le dessin fonctionne quand
      // même sans capture, on continue simplement.
    }
    // AUDIT (piste A) : capture l'état AVANT écrasement — si un autre
    // pointeur possédait activePointerId/touchScrollState/currentStroke à
    // cet instant, ce log révèle l'orphelinage (rien ne le nettoie ici).
    penAuditLog(`${e.pointerType.toUpperCase()} DOWN accepted (avant écrasement activePointerId)`, {
      ...pointerAuditFields(e),
      prevActivePointerId: activePointerId.current,
      prevHasTouchScrollState: !!touchScrollState.current,
      prevHasCurrentStroke: !!currentStroke.current,
    });
    if (PEN_AUDIT && e.pointerType === "pen") {
      const attempt = penAttempts.current.get(e.pointerId);
      if (attempt) attempt.accepted = true;
    }
    activePointerId.current = e.pointerId;
    const pos = getPos(e);

    // Règle : si le Pencil (ou la souris, utilisée comme repli de test tant
    // qu'aucun Apple Pencil n'est disponible — même logique d'accroche,
    // jamais le doigt qui reste réservé à manipuler la règle/naviguer) se
    // pose assez près d'un de ses deux bords, tout ce trait (jusqu'au
    // relâchement) s'y accroche — décidé une seule fois ici, jamais
    // réévalué en cours de geste (voir RULER_SNAP_THRESHOLD). Le point de
    // départ est lui-même déjà projeté, pour que le tout premier point du
    // trait soit déjà exactement sur le bord.
    const isRulerDrawingPointer = e.pointerType === "pen" || e.pointerType === "mouse";
    if (rulerActive && ruler && isRulerDrawingPointer && (tool === "pen" || tool === "highlighter")) {
      const { edge, distance } = closestEdge(ruler, pos.x, pos.y);
      rulerStrokeEdge.current = distance <= RULER_SNAP_THRESHOLD ? edge : null;
      if (rulerStrokeEdge.current) {
        const projected = projectOntoEdge(rulerStrokeEdge.current, pos.x, pos.y);
        pos.x = projected.x;
        pos.y = projected.y;
      }
    } else {
      rulerStrokeEdge.current = null;
    }

    if (e.pointerType === "pen" && (tool === "pen" || tool === "highlighter")) {
      tapStartInfo.current = { x: pos.x, y: pos.y, time: Date.now() };
      tapIsCandidate.current = true;
    } else {
      tapStartInfo.current = null;
      tapIsCandidate.current = false;
    }

    lockedSnap.current = null;
    snapAnimation.current = null;
    holdAnchorPos.current = null;
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (debugHoldDetection) {
      debugInfo.current = { ...debugInfo.current, pointerType: e.pointerType, tool, lastResult: "—" };
    }

    if (tool === "eraser") {
      erasedStrokeIds.current = new Set();
      erasedShapeIds.current = new Set();
      erasedImageIds.current = new Set();
      erasedTextBoxIds.current = new Set();
      partialErasePreview.current = null;
      // Positionne tout de suite l'aperçu au point d'appui (plutôt que de le
      // remettre à null) : sans ça, le cercle du mode Partielle disparaîtrait
      // un instant avant de réapparaître au premier déplacement — voir
      // updateEraserHoverPreview, aussi appelée en continu pendant le geste
      // par handlePointerMove.
      if (e.pointerType !== "touch") {
        updateEraserHoverPreview(pos);
        scheduleRender();
      } else {
        hoverEraserPos.current = null;
        hoveredStrokeId.current = null;
      }
      eraseAt(pos);
      lastEraserPos.current = { x: pos.x, y: pos.y };
    } else if (e.pointerType === "touch" && touchDrawBlocked) {
      // Doigt ≠ écriture : jamais de trait/forme au doigt avec ces outils —
      // il fait défiler la page comme le ferait Déplacement à la place
      // (voir touchScrollState, état séparé de panState/tool==="pan").
      const container = containerRef.current;
      touchScrollState.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startScrollLeft: container ? container.scrollLeft : 0,
        startScrollTop: container ? container.scrollTop : 0,
      };
      penAuditLog("TOUCH DOWN → touchScrollState started", { pointerId: e.pointerId });
    } else if (tool === "shapes") {
      shapeStartPos.current = { x: pos.x, y: pos.y };
      currentShape.current = {
        id: crypto.randomUUID(),
        type: shapeType,
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        color: shapeColor,
        strokeWidth: shapeStrokeWidth,
      };
      scheduleRender();
    } else if (tool === "photo") {
      tryStartImageInteraction(pos);
      scheduleRender();
    } else if (tool === "text") {
      // Un tap sur la feuille avec l'outil "T" crée un nouveau bloc de
      // texte à cet endroit et le passe aussitôt en édition — un clic sur
      // un bloc déjà existant, lui, est intercepté par ce bloc lui-même
      // (voir TextBoxOverlay, qui arrête la propagation de son propre
      // pointerdown) et n'arrive donc jamais jusqu'ici.
      // preventDefault : sans lui, une fois ce handler terminé, le
      // navigateur applique son action par défaut pour ce pointerdown —
      // comme sa cible réelle est ce <canvas> (non focusable), un clic
      // SOURIS reprend alors le focus qu'on vient de poser sur le nouveau
      // bloc (voir le focus() ci-dessous), le bloc encore vide se
      // retrouve immédiatement supprimé. Sans incidence sur le tactile
      // (déjà touch-action: none ici).
      e.preventDefault();
      const id = crypto.randomUUID();
      // Ne doit jamais dépasser horizontalement les limites de la page : si
      // le tap a lieu trop près du bord droit, on décale x vers la gauche
      // plutôt que de créer un bloc partiellement hors page.
      const width = Math.min(DEFAULT_TEXTBOX_WIDTH, PAGE_WIDTH);
      const x = Math.min(Math.max(0, pos.x), PAGE_WIDTH - width);
      const newBox: TextBoxElement = {
        id,
        x,
        y: pos.y,
        width,
        html: "",
      };
      // flushSync : force React à committer (et exécuter les layout effects,
      // voir l'autofocus en useLayoutEffect de TextBoxOverlay) avant de
      // rendre la main au navigateur — reste au plus près du tap d'origine
      // pour que Safari/iOS associe le .focus() programmatique qui suit à
      // ce même geste utilisateur et ouvre le clavier dès le premier tap.
      // Geste ponctuel (créer une TextBox), jamais un chemin appelé en
      // boucle : le coût d'un rendu synchrone est négligeable ici.
      flushSync(() => {
        setDraftTextBoxes((prev) => [...prev, newBox]);
        setSelectedTextBoxId(id);
        setAutoFocusTextBoxId(id);
      });
    } else if (tool === "pan") {
      // "Déplacement" fait aussi office d'outil de sélection pour les
      // photos déjà en place : cliquer directement dessus la sélectionne/
      // la déplace au lieu de faire défiler la page — cliquer à côté
      // continue de faire défiler comme avant (voir tryStartImageInteraction).
      if (tryStartImageInteraction(pos)) {
        scheduleRender();
      } else {
        const container = containerRef.current;
        panState.current = {
          startClientX: e.clientX,
          startClientY: e.clientY,
          startScrollLeft: container ? container.scrollLeft : 0,
          startScrollTop: container ? container.scrollTop : 0,
        };
        setIsPanning(true);
      }
    } else if (tool === "highlighter") {
      currentStroke.current = {
        id: crypto.randomUUID(),
        tool: "highlighter",
        color: highlighterColor,
        size: highlighterSize,
        opacity: highlighterOpacity,
        highlight: { mode: highlighterMode },
        // Mode Droit : 2 points dès le départ (l'ancrage et lui-même) — le
        // second est remplacé à chaque déplacement (voir handlePointerMove),
        // jamais accumulé comme en mode Libre.
        points: highlighterMode === "straight" ? [pos, pos] : [pos],
      };
      penAuditLog(`${e.pointerType.toUpperCase()} DOWN → stroke started (highlighter)`, {
        pointerId: e.pointerId,
        strokeId: currentStroke.current.id,
      });
      if (PEN_AUDIT && e.pointerType === "pen") {
        markPenAttemptStarted(e.pointerId, currentStroke.current.id);
      }
      if (highlighterMode === "freehand" && !rulerStrokeEdge.current) {
        // Redressement automatique par maintien — seulement en Libre et
        // hors accroche à la Règle : en Droit ou déjà accroché à un bord,
        // le tracé est déjà une ligne droite, inutile de le redresser.
        scheduleHoldCheck(pos, "highlighter");
      }
      scheduleRender();
    } else if (tool === "lasso") {
      const raw = selection ? rawSelectionBounds(selection) : null;
      if (raw) {
        const handle = selectionHandleHitTest(raw, pos.x, pos.y);
        if (handle) {
          beginSelectionDrag(handle, pos, raw);
          scheduleRender();
        } else if (isPointInBounds(raw, pos.x, pos.y)) {
          beginSelectionDrag("move", pos, raw);
          scheduleRender();
        } else {
          // Clic/tap hors sélection : désélectionne, doigt inclus (§15 du
          // plan validé). Seuls le Pencil/la souris enchaînent aussitôt sur
          // un nouveau lasso à cet endroit — le doigt ne dessine jamais de
          // lasso, seulement le Pencil/la souris.
          setSelection(null);
          if (e.pointerType !== "touch") {
            lassoPath.current = [{ x: pos.x, y: pos.y }];
          }
          scheduleRender();
        }
      } else if (e.pointerType !== "touch") {
        lassoPath.current = [{ x: pos.x, y: pos.y }];
        scheduleRender();
      }
    } else {
      currentStroke.current = {
        id: crypto.randomUUID(),
        tool: "pen",
        penType,
        color: penColor,
        size: penSize,
        points: [pos],
      };
      penAuditLog(`${e.pointerType.toUpperCase()} DOWN → stroke started (pen)`, {
        pointerId: e.pointerId,
        strokeId: currentStroke.current.id,
      });
      if (PEN_AUDIT && e.pointerType === "pen") {
        markPenAttemptStarted(e.pointerId, currentStroke.current.id);
      }
      if (!rulerStrokeEdge.current) {
        scheduleHoldCheck(pos, "pen");
      }
      scheduleRender();
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "touch" && rulerTouchIds.current.includes(e.pointerId)) {
      rulerLiveClientPos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      updateRulerFromGesture();
      scheduleRender();
      return;
    }
    if (e.pointerType === "touch" && touchPoints.current.has(e.pointerId)) {
      touchPoints.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinchState.current && touchPoints.current.size >= 2) {
        const pts = Array.from(touchPoints.current.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const ratio = dist / pinchState.current.initialDistance;
        // Le centre du pincement suit les doigts à chaque mouvement (plutôt
        // que de rester figé sur le point de départ), pour un zoom qui
        // "colle" aux doigts comme dans Google Maps/Photos.
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        onPinchZoom(pinchState.current.initialZoom * ratio, midX, midY);
        return;
      }
    }

    // Aperçu au survol de la Gomme, avant tout clic mais aussi *pendant* un
    // geste d'effacement actif (pas seulement quand activePointerId.current
    // est null) — sinon le cercle du mode Partielle se fige dès qu'on appuie
    // au lieu de continuer à suivre le curseur pendant qu'on efface. Réservé
    // à un pointeur à détection de survol (souris/stylet) — le tactile ne
    // déclenche pas ce chemin sans contact, ce qui suffit à exclure le doigt
    // (limite assumée, voir plan validé).
    if (tool === "eraser" && e.pointerType !== "touch") {
      updateEraserHoverPreview(getPos(e));
      scheduleRender();
    } else if (hoverEraserPos.current || hoveredStrokeId.current) {
      hoverEraserPos.current = null;
      hoveredStrokeId.current = null;
      scheduleRender();
    }

    if (activePointerId.current !== e.pointerId) {
      // AUDIT round 2 : throttlé (300ms/pointerId) — le survol Pencil
      // (pointerId bas et stable) peut spammer ce cas à haute fréquence.
      penAuditLogThrottled(
        e.pointerId,
        `${e.pointerType.toUpperCase()} MOVE blocked: activePointerId mismatch`,
        pointerAuditFields(e),
      );
      return;
    }

    if (touchScrollState.current) {
      // Défilement au doigt démarré à la place d'un trait/forme (voir
      // handlePointerDown) — même formule que Déplacement, dupliquée
      // volontairement pour ne rien partager avec panState.
      penAuditLogThrottled(
        e.pointerId,
        `${e.pointerType.toUpperCase()} MOVE blocked: touchScrollState`,
        pointerAuditFields(e),
      );
      const container = containerRef.current;
      if (container) {
        container.scrollLeft = touchScrollState.current.startScrollLeft - (e.clientX - touchScrollState.current.startClientX);
        container.scrollTop = touchScrollState.current.startScrollTop - (e.clientY - touchScrollState.current.startClientY);
      }
      return;
    }

    if (e.pointerType === "pen") {
      lastPenTime.current = Date.now();
    }
    const pos = getPos(e);
    if (PEN_AUDIT && currentStroke.current && auditLastLoggedStrokeId.current !== currentStroke.current.id) {
      // Un seul log par trait (pas un par point) pour rester lisible même
      // sur une lettre à beaucoup de points.
      auditLastLoggedStrokeId.current = currentStroke.current.id;
      penAuditLog(`${e.pointerType.toUpperCase()} MOVE accepted → point ajouté au trait`, {
        pointerId: e.pointerId,
        strokeId: currentStroke.current.id,
      });
    }
    // AUDIT (round 3) : compteur de mouvements par tentative — mutation pure
    // de l'objet en ref, JAMAIS de setState ici (voir plan validé). Le
    // panneau affichera la valeur à jour à la prochaine transition qui,
    // elle, déclenche déjà un re-rendu via un penAuditLog voisin.
    if (PEN_AUDIT && e.pointerType === "pen" && currentStroke.current) {
      const attempt = penAttempts.current.get(e.pointerId);
      if (attempt) attempt.moves += 1;
    }
    if (rulerStrokeEdge.current) {
      // Trait déjà accroché à un bord de la règle (décidé au posé, voir
      // handlePointerDown) : chaque point suivant est aussi projeté sur ce
      // même bord, quel que soit le tremblement réel du geste.
      const projected = projectOntoEdge(rulerStrokeEdge.current, pos.x, pos.y);
      pos.x = projected.x;
      pos.y = projected.y;
    }

    if (tapIsCandidate.current && tapStartInfo.current) {
      const start = tapStartInfo.current;
      if (Math.hypot(pos.x - start.x, pos.y - start.y) > TAP_MAX_MOVEMENT) {
        tapIsCandidate.current = false;
      }
    }

    if (tool === "pan") {
      if (updateImageInteractionPreview(pos)) return;
      if (panState.current) {
        // `containerRef` est désormais partagé par tout le carnet (voir la
        // prop du même nom) : écrire dessus fait défiler naturellement
        // jusqu'à la page suivante/précédente une fois la limite haute/basse
        // de la page courante dépassée, sans relais explicite — un seul
        // conteneur défilant pour tout le document.
        const container = containerRef.current;
        if (container) {
          container.scrollLeft = panState.current.startScrollLeft - (e.clientX - panState.current.startClientX);
          container.scrollTop = panState.current.startScrollTop - (e.clientY - panState.current.startClientY);
        }
      }
      return;
    }

    if (tool === "text") {
      // Rien à suivre au niveau du canvas : le placement du bloc est
      // immédiat au tap, et son éventuel déplacement/redimensionnement est
      // géré par son propre gestionnaire de pointeur (voir TextBoxOverlay).
      return;
    }

    if (tool === "eraser") {
      eraseAlongPath(lastEraserPos.current, pos);
      lastEraserPos.current = { x: pos.x, y: pos.y };
      return;
    }

    if (tool === "shapes") {
      if (currentShape.current && shapeStartPos.current) {
        currentShape.current.width = pos.x - shapeStartPos.current.x;
        currentShape.current.height = pos.y - shapeStartPos.current.y;
        scheduleRender();
      }
      return;
    }

    if (tool === "photo") {
      updateImageInteractionPreview(pos);
      return;
    }

    if (tool === "lasso") {
      const drag = selectionDragMode.current;
      if (drag) {
        if (drag.mode === "move") {
          dragLastClientPosRef.current = { x: e.clientX, y: e.clientY };
          updateCrossPageSelectionDrag(e.clientX, e.clientY);
          updateAutoScrollForSelectionDrag(e.clientY);
        } else {
          // Redimensionnement : échelle uniforme (ratio de distance depuis
          // le coin opposé, qui reste fixe) — préserve les proportions et
          // ancre au coin opposé, quel que soit l'angle du glisser.
          const opposite: Record<SelectionHandle, SelectionHandle> = { nw: "se", ne: "sw", se: "nw", sw: "ne" };
          const b = drag.startBounds;
          const cornerOf = (h: SelectionHandle): Point => ({
            x: h === "nw" || h === "sw" ? b.x0 : b.x1,
            y: h === "nw" || h === "ne" ? b.y0 : b.y1,
          });
          const anchor = cornerOf(opposite[drag.mode]);
          const startCorner = cornerOf(drag.mode);
          const startDist = Math.hypot(startCorner.x - anchor.x, startCorner.y - anchor.y) || 1;
          const nowDist = Math.hypot(pos.x - anchor.x, pos.y - anchor.y);
          selectionTransform.current = { anchor, scale: Math.max(MIN_SELECTION_SCALE, nowDist / startDist) };
        }
        // Les traits/formes/photos se redessinent via renderAll (canvas,
        // scheduleRender suffit) ; les blocs de texte sélectionnés sont du
        // DOM (voir displayTextBoxes) et ont besoin d'un rendu React pour
        // suivre — seulement quand la sélection en contient, pour ne pas
        // déclencher de rendu React inutile sur un déplacement de traits.
        if (selection && selection.textBoxes.size > 0) {
          setSelectionTick((t) => t + 1);
        }
        scheduleRender();
        return;
      }
      if (lassoPath.current.length > 0 && e.pointerType !== "touch") {
        const last = lassoPath.current[lassoPath.current.length - 1];
        if (Math.hypot(pos.x - last.x, pos.y - last.y) >= LASSO_MIN_POINT_SPACING) {
          lassoPath.current = [...lassoPath.current, { x: pos.x, y: pos.y }];
          scheduleRender();
        }
      }
      return;
    }

    if (!currentStroke.current) return;

    if ((tool === "pen" || tool === "highlighter") && lockedSnap.current) {
      // Verrouillé : la géométrie ne bouge plus jamais — le stylet
      // n'ajuste plus que le point d'arrivée (ligne, y compris pour le
      // Surligneur en Libre après redressement automatique) ou le coin
      // opposé à l'ancrage (cercle/rectangle, Stylo uniquement).
      lockedSnap.current = { ...lockedSnap.current, current: { x: pos.x, y: pos.y } };
      snapAnimation.current = null;
      scheduleRender();
      return;
    }

    if (tool === "highlighter" && currentStroke.current.highlight?.mode === "straight") {
      // Mode Droit : le premier point reste l'ancrage fixe, seul le second
      // (point d'arrivée) est remplacé à chaque déplacement — pas
      // d'accumulation de points intermédiaires comme en mode Libre.
      const anchor = currentStroke.current.points[0];
      currentStroke.current.points = [anchor, snapStraightEndpoint(anchor, pos)];
      scheduleRender();
      return;
    }

    currentStroke.current.points.push(pos);

    if (!rulerStrokeEdge.current && (tool === "pen" || (tool === "highlighter" && highlighterMode === "freehand"))) {
      const anchor = holdAnchorPos.current;
      const distanceFromAnchor = anchor ? Math.hypot(pos.x - anchor.x, pos.y - anchor.y) : Infinity;

      if (debugHoldDetection) {
        debugInfo.current = {
          ...debugInfo.current,
          pointerType: e.pointerType,
          tool,
          distanceFromAnchor: Math.round(distanceFromAnchor),
          elapsedMs: anchor ? Math.round(performance.now() - holdAnchorTime.current) : 0,
        };
      }

      if (distanceFromAnchor > HOLD_JITTER_TOLERANCE) {
        // Mouvement réel (pas juste du bruit de capteur) : on repart de zéro.
        snapAnimation.current = null;
        scheduleHoldCheck(pos, tool === "pen" ? "pen" : "highlighter");
      }
      // Sinon, gigue tolérée : on laisse le minuteur déjà armé continuer sans
      // le réinitialiser, pour qu'il puisse effectivement arriver à son terme.
    }

    scheduleRender();
  }

  function endStroke() {
    penAuditLog("endStroke() entry");
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    holdAnchorPos.current = null;
    rulerStrokeEdge.current = null;

    if (touchScrollState.current) {
      // Défilement au doigt (voir handlePointerDown/handlePointerMove) —
      // jamais de trait/forme à committer, juste nettoyer cet état séparé.
      penAuditLog("endStroke() → branche touchScrollState : trait NON committé, juste nettoyé");
      touchScrollState.current = null;
      activePointerId.current = null;
      scheduleRender();
      onActionComplete?.();
      return;
    }

    if (tool === "pan") {
      if (commitImageInteraction()) {
        activePointerId.current = null;
        scheduleRender();
        onActionComplete?.();
        return;
      }
      panState.current = null;
      setIsPanning(false);
      activePointerId.current = null;
      onActionComplete?.();
      return;
    }

    if (tool === "text") {
      activePointerId.current = null;
      onActionComplete?.();
      return;
    }

    if (tool === "eraser") {
      const hasErasedStrokes = !!erasedStrokeIds.current && erasedStrokeIds.current.size > 0;
      const hasErasedShapes = !!erasedShapeIds.current && erasedShapeIds.current.size > 0;
      const hasErasedImages = !!erasedImageIds.current && erasedImageIds.current.size > 0;
      const hasErasedTextBoxes = !!erasedTextBoxIds.current && erasedTextBoxIds.current.size > 0;
      const hasPartialErase = !!partialErasePreview.current;
      if (hasErasedStrokes || hasErasedShapes || hasErasedImages || hasErasedTextBoxes || hasPartialErase) {
        // strokesRef/shapesRef/imagesRef/textBoxesRef sont encore l'état
        // "avant effacement" à ce stade (eraseAt/erasePartialAt ne les
        // mutent pas) : on calcule les tableaux filtrés ici, pour committer,
        // sans jamais avoir modifié les refs avant que commitDoc n'y lise
        // son instantané "avant" pour la pile d'annulation.
        const nextStrokes = hasPartialErase
          ? partialErasePreview.current!
          : hasErasedStrokes
            ? strokesRef.current.filter((s) => !erasedStrokeIds.current!.has(s.id))
            : strokesRef.current;
        const nextShapes = hasErasedShapes
          ? shapesRef.current.filter((s) => !erasedShapeIds.current!.has(s.id))
          : shapesRef.current;
        const nextImages = hasErasedImages
          ? imagesRef.current.filter((i) => !erasedImageIds.current!.has(i.id))
          : imagesRef.current;
        const nextTextBoxes = hasErasedTextBoxes
          ? textBoxesRef.current.filter((t) => !erasedTextBoxIds.current!.has(t.id))
          : textBoxesRef.current;
        commitDoc({ strokes: nextStrokes, shapes: nextShapes, images: nextImages, textBoxes: nextTextBoxes });
      }
      erasedStrokeIds.current = null;
      erasedShapeIds.current = null;
      erasedImageIds.current = null;
      erasedTextBoxIds.current = null;
      partialErasePreview.current = null;
      hoverEraserPos.current = null;
      hoveredStrokeId.current = null;
      lastEraserPos.current = null;
      activePointerId.current = null;
      scheduleRender();
      onActionComplete?.();
      return;
    }

    if (tool === "shapes") {
      const shape = currentShape.current;
      currentShape.current = null;
      shapeStartPos.current = null;
      activePointerId.current = null;
      if (shape && Math.abs(shape.width) > 4 && Math.abs(shape.height) > 4) {
        commitDoc({
          strokes: strokesRef.current,
          shapes: [...shapesRef.current, shape],
          images: imagesRef.current,
          textBoxes: textBoxesRef.current,
        });
      }
      scheduleRender();
      onActionComplete?.();
      return;
    }

    if (tool === "photo") {
      commitImageInteraction();
      activePointerId.current = null;
      scheduleRender();
      onActionComplete?.();
      return;
    }

    if (tool === "lasso") {
      if (selectionDragMode.current) {
        const target = crossPageTargetRef.current;
        if (target && selection) {
          // Transfert réel cross-page (Option A validée) : deux commitDoc
          // séparés, un par page — voir le plan, aucun historique partagé
          // entre pages aujourd'hui. La cible reçoit les éléments déjà
          // repositionnés (mêmes ids, pas une copie) et en fait sa nouvelle
          // sélection ; la source les retire des siens. Chacun un seul
          // commitDoc, donc chacun une seule action Undo (deux au total).
          const data = translateAll(cloneSelected(selection), target.dx, target.dy);
          crossPageDrag.transfer(target.pageId, data);
          commitDoc({
            strokes: strokesRef.current.filter((s) => !selection.strokes.has(s.id)),
            shapes: shapesRef.current.filter((s) => !selection.shapes.has(s.id)),
            images: imagesRef.current.filter((img) => !selection.images.has(img.id)),
            textBoxes: textBoxesRef.current.filter((tb) => !selection.textBoxes.has(tb.id)),
          });
          setSelection(null);
          selectionDragMode.current = null;
          selectionTransform.current = null;
          setSelectionDragging(false);
          crossPageTargetRef.current = null;
          stopAutoScroll();
          dragLastClientPosRef.current = null;
          activePointerId.current = null;
          scheduleRender();
          onActionComplete?.();
          return;
        }
        // Déplacement/redimensionnement resté sur cette page (cas le plus
        // fréquent) : un seul commitDoc (voir commitSelectionDrag), donc une
        // seule action Undo — comportement strictement inchangé.
        commitSelectionDrag();
        stopAutoScroll();
        dragLastClientPosRef.current = null;
        activePointerId.current = null;
        scheduleRender();
        onActionComplete?.();
        return;
      }
      const path = lassoPath.current;
      lassoPath.current = [];
      if (path.length > 2) {
        // Sélection calculée une seule fois, ici, jamais pendant le tracé
        // (voir plan validé) — préfiltrage par bounding box avant le test
        // précis, pour rester rapide même avec des milliers de traits.
        const lassoBounds = boundsOfPoints(path);
        const next: SelectionIds = { strokes: new Set(), shapes: new Set(), images: new Set(), textBoxes: new Set() };
        for (const s of strokesRef.current) {
          if (!boundsIntersect(strokeBounds(s), lassoBounds)) continue;
          if (strokeMostlyInPolygon(s, path)) next.strokes.add(s.id);
        }
        for (const s of shapesRef.current) {
          const b = boxBounds(s);
          if (!boundsIntersect(b, lassoBounds)) continue;
          if (boundsMostlyInPolygon(b, path)) next.shapes.add(s.id);
        }
        for (const img of imagesRef.current) {
          const b = boxBounds(img);
          if (!boundsIntersect(b, lassoBounds)) continue;
          if (boundsMostlyInPolygon(b, path)) next.images.add(img.id);
        }
        for (const tb of textBoxesRef.current) {
          const h = textBoxHeights.current.get(tb.id) ?? MIN_TEXTBOX_HIT_HEIGHT;
          const b = textBoxBounds(tb, h);
          if (!boundsIntersect(b, lassoBounds)) continue;
          if (boundsMostlyInPolygon(b, path)) next.textBoxes.add(tb.id);
        }
        const hasAny = next.strokes.size > 0 || next.shapes.size > 0 || next.images.size > 0 || next.textBoxes.size > 0;
        setSelection(hasAny ? next : null);
      }
      activePointerId.current = null;
      scheduleRender();
      onActionComplete?.();
      return;
    }

    const finished = currentStroke.current;
    currentStroke.current = null;
    activePointerId.current = null;
    penAuditLog("endStroke() → activePointerId remis à null", { hadFinishedStroke: !!finished });

    const locked = lockedSnap.current;
    lockedSnap.current = null;
    snapAnimation.current = null;

    if (locked) {
      if (locked.kind === "line") {
        const stroke: Stroke =
          locked.tool === "highlighter"
            ? {
                id: crypto.randomUUID(),
                tool: "highlighter",
                color: locked.color,
                size: locked.size,
                opacity: highlighterOpacity,
                highlight: { mode: "freehand" },
                points: [
                  { x: locked.anchor.x, y: locked.anchor.y, pressure: 0.5 },
                  { x: locked.current.x, y: locked.current.y, pressure: 0.5 },
                ],
              }
            : {
                id: crypto.randomUUID(),
                tool: "pen",
                penType: locked.penType ?? "fineliner",
                color: locked.color,
                size: locked.size,
                points: [
                  { x: locked.anchor.x, y: locked.anchor.y, pressure: 0.5 },
                  { x: locked.current.x, y: locked.current.y, pressure: 0.5 },
                ],
              };
        commitDoc({
          strokes: [...strokesRef.current, stroke],
          shapes: shapesRef.current,
          images: imagesRef.current,
          textBoxes: textBoxesRef.current,
        });
      } else if (locked.shapeType) {
        const shape: ShapeElement = {
          id: crypto.randomUUID(),
          type: locked.shapeType,
          x: locked.anchor.x,
          y: locked.anchor.y,
          width: locked.current.x - locked.anchor.x,
          height: locked.current.y - locked.anchor.y,
          color: locked.color,
          strokeWidth: locked.size,
        };
        commitDoc({
          strokes: strokesRef.current,
          shapes: [...shapesRef.current, shape],
          images: imagesRef.current,
          textBoxes: textBoxesRef.current,
        });
      }
      tapStartInfo.current = null;
      lastTap.current = null;
      scheduleRender();
      onActionComplete?.();
      return;
    }

    if (!finished) {
      penAuditLog("endStroke() → return: aucun trait en cours (finished=null)");
      scheduleRender();
      return;
    }

    const start = tapStartInfo.current;
    const duration = start ? Date.now() - start.time : Infinity;
    const isTap = tapIsCandidate.current && start !== null && duration <= TAP_MAX_DURATION_MS;
    tapStartInfo.current = null;
    penAuditLog(`endStroke() → stroke classified ${isTap ? "tap" : "trait normal"}`, {
      strokeId: finished.id,
      durationMs: start ? duration : null,
      tapMaxDurationMs: TAP_MAX_DURATION_MS,
      isTap,
    });
    if (PEN_AUDIT) {
      getPenAttemptByStrokeId(finished.id)?.notes.push(isTap ? "classified: tap" : "classified: normal");
    }

    if (isTap && start) {
      const last = lastTap.current;
      const distanceFromLastTap = last ? Math.hypot(start.x - last.x, start.y - last.y) : null;
      const isDoubleTap =
        last !== null &&
        Date.now() - last.time <= DOUBLE_TAP_MAX_INTERVAL_MS &&
        Math.hypot(start.x - last.x, start.y - last.y) <= DOUBLE_TAP_MAX_DISTANCE;
      penAuditLog(`endStroke() → doubleTap=${isDoubleTap}`, {
        strokeId: finished.id,
        hadPreviousTap: last !== null,
        intervalSinceLastTapMs: last ? Date.now() - last.time : null,
        doubleTapMaxIntervalMs: DOUBLE_TAP_MAX_INTERVAL_MS,
        distanceFromLastTap,
        doubleTapMaxDistance: DOUBLE_TAP_MAX_DISTANCE,
      });

      if (isDoubleTap) {
        // Double-tap détecté : on annule ce tout petit trait (le point qui
        // aurait été laissé par ce second tap) et on déclenche la bascule
        // vers la gomme plutôt que de committer un trait.
        penAuditLog("endStroke() → stroke discarded (double-tap), onPenDoubleTap() appelé", {
          strokeId: finished.id,
        });
        if (PEN_AUDIT) {
          const attempt = getPenAttemptByStrokeId(finished.id);
          if (attempt) {
            attempt.committed = false;
            attempt.notes.push("discarded: double-tap");
          }
        }
        lastTap.current = null;
        scheduleRender();
        onPenDoubleTap?.();
        return;
      }
      lastTap.current = { x: start.x, y: start.y, time: Date.now() };
    } else {
      lastTap.current = null;
    }

    penAuditLog("endStroke() → stroke committed", { strokeId: finished.id, pointCount: finished.points.length });
    if (PEN_AUDIT) {
      const attempt = getPenAttemptByStrokeId(finished.id);
      if (attempt) attempt.committed = true;
    }
    if (finished.points.length > 0) {
      commitDoc({
        strokes: [...strokesRef.current, finished],
        shapes: shapesRef.current,
        images: imagesRef.current,
        textBoxes: textBoxesRef.current,
      });
    }
    scheduleRender();
    onActionComplete?.();
  }

  function endPinchIfDone(pointerId: number) {
    touchPoints.current.delete(pointerId);
    if (touchPoints.current.size < 2) pinchState.current = null;
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    penAuditLog(`${e.pointerType.toUpperCase()} UP entry`, pointerAuditFields(e));
    if (e.pointerType === "touch") {
      endPinchIfDone(e.pointerId);
      if (endRulerTouch(e.pointerId)) {
        scheduleRender();
        penAuditLog("TOUCH UP return: endRulerTouch", { pointerId: e.pointerId });
        return;
      }
    }
    if (activePointerId.current !== e.pointerId) {
      penAuditLog(`${e.pointerType.toUpperCase()} UP blocked: activePointerId mismatch`, {
        pointerId: e.pointerId,
      });
      if (PEN_AUDIT && e.pointerType === "pen") {
        penAttempts.current.get(e.pointerId)?.notes.push("UP blocked: mismatch");
      }
      return;
    }
    if (PEN_AUDIT && e.pointerType === "pen") {
      const attempt = penAttempts.current.get(e.pointerId);
      if (attempt && attempt.upAt === null) attempt.upAt = Date.now();
    }
    endStroke();
  }

  function handlePointerCancel(e: React.PointerEvent<HTMLCanvasElement>) {
    penAuditLog(`${e.pointerType.toUpperCase()} CANCEL entry`, pointerAuditFields(e));
    if (e.pointerType === "touch") {
      endPinchIfDone(e.pointerId);
      if (endRulerTouch(e.pointerId)) {
        scheduleRender();
        penAuditLog("TOUCH CANCEL return: endRulerTouch", { pointerId: e.pointerId });
        return;
      }
    }
    // Coupe l'aperçu au survol de la Gomme dès que le pointeur quitte le
    // canvas (onPointerLeave est câblé sur ce même handler), y compris hors
    // geste actif — sinon il resterait figé après la sortie du curseur.
    if (hoverEraserPos.current || hoveredStrokeId.current) {
      hoverEraserPos.current = null;
      hoveredStrokeId.current = null;
      scheduleRender();
    }
    if (activePointerId.current !== e.pointerId) {
      penAuditLog(`${e.pointerType.toUpperCase()} CANCEL blocked: activePointerId mismatch`, {
        pointerId: e.pointerId,
      });
      return;
    }
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    penAuditLog(`${e.pointerType.toUpperCase()} CANCEL → reset complet (trait abandonné, non committé)`, {
      pointerId: e.pointerId,
    });
    if (PEN_AUDIT && e.pointerType === "pen") {
      const attempt = penAttempts.current.get(e.pointerId);
      if (attempt) attempt.cancelOrLost = true;
    }
    currentStroke.current = null;
    currentShape.current = null;
    shapeStartPos.current = null;
    lockedSnap.current = null;
    snapAnimation.current = null;
    holdAnchorPos.current = null;
    rulerStrokeEdge.current = null;
    erasedStrokeIds.current = null;
    erasedShapeIds.current = null;
    erasedImageIds.current = null;
    erasedTextBoxIds.current = null;
    partialErasePreview.current = null;
    hoverEraserPos.current = null;
    hoveredStrokeId.current = null;
    lastEraserPos.current = null;
    imageDragMode.current = null;
    dragPreview.current = null;
    selectionDragMode.current = null;
    selectionTransform.current = null;
    setSelectionDragging(false);
    clearCrossPageDragState();
    lassoPath.current = [];
    panState.current = null;
    touchScrollState.current = null;
    setIsPanning(false);
    activePointerId.current = null;
    tapStartInfo.current = null;
    tapIsCandidate.current = false;
    scheduleRender();
  }

  /** `onPointerLeave` du canvas — casse normalement le geste en cours
   * (`handlePointerCancel`), sauf dans un cas précis : un déplacement/
   * redimensionnement de sélection Lasso actif avec ce même pointeur. Ce
   * geste doit pouvoir continuer une fois le pointeur visuellement passé
   * sur une page voisine (drag cross-page) — `setPointerCapture` (posé au
   * pointerdown) continue de livrer les pointermove/pointerup suivants à
   * ce canvas avec des coordonnées correctes, mais certains navigateurs
   * (Safari/iPadOS confirmé) déclenchent quand même `pointerleave` dès que
   * le pointeur quitte les limites DOM du canvas, capture ou non — sans ce
   * garde-fou, ça annulait le geste à tort. Pour tout le reste (dessin,
   * gomme, règle, image, nouveau tracé de lasso...), comportement
   * strictement inchangé. */
  function handlePointerLeaveCanvas(e: React.PointerEvent<HTMLCanvasElement>) {
    penAuditLog(`${e.pointerType.toUpperCase()} LEAVE entry`, pointerAuditFields(e));
    if (selectionDragMode.current && activePointerId.current === e.pointerId) return;
    handlePointerCancel(e);
  }

  /** AUDIT round 2 — TEMPORAIRE : purement observationnel, aucun état
   * touché. Le canvas n'avait jusqu'ici aucun handler pour cet événement ;
   * on veut savoir s'il se déclenche pendant le "trou" entre deux traits
   * (perte de capture inattendue), invisible jusqu'ici. */
  function handleLostPointerCapture(e: React.PointerEvent<HTMLCanvasElement>) {
    penAuditLog(`${e.pointerType.toUpperCase()} LOSTCAPTURE entry`, pointerAuditFields(e));
    if (PEN_AUDIT && e.pointerType === "pen") {
      const attempt = penAttempts.current.get(e.pointerId);
      if (attempt) attempt.cancelOrLost = true;
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full"
      style={{
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
    >
      {/* Plus de conteneur/wrapper de zoom propre à cette page : le canvas
          remplit directement son slot (100%/100%), dont la taille réelle à
          l'écran dépend de la fenêtre de zoom/défilement partagée que
          possède NotesPageClient (un seul wrapper zoomé pour tout le
          carnet, pas un par page — voir la prop `containerRef`). */}
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          touchAction: "none",
          cursor:
            tool === "eraser"
              ? "cell"
              : tool === "photo"
                ? "default"
                : tool === "pan"
                  ? isPanning
                    ? "grabbing"
                    : "grab"
                  : "crosshair",
          display: "block",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
          WebkitTapHighlightColor: "transparent",
        }}
        className="bg-card"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeaveCanvas}
        onLostPointerCapture={handleLostPointerCapture}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Blocs de texte : rendus en DOM (pas sur le canvas) pour profiter
          d'une vraie édition riche contentEditable — ce calque partage
          exactement le même repère 0..PAGE_WIDTH/PAGE_HEIGHT que le canvas
          grâce au positionnement en pourcentage. Le calque lui-même reste
          toujours `pointer-events: none` (les clics sur une zone vide
          doivent atteindre le canvas en dessous, pour dessiner/gommer/etc.)
          ; seuls les blocs de texte individuels redeviennent interactifs,
          et seulement avec l'outil "T" actif (voir la prop `interactive`
          de TextBoxOverlay). */}
      <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
        {[...textBoxes, ...draftTextBoxes].map((tb) => {
          const displayTb =
            selection?.textBoxes.has(tb.id) && selectionTransform.current
              ? applySelectionTransform(tb, selectionTransform.current, translateTextBox, scaleTextBox)
              : tb;
          return (
            <TextBoxOverlay
              key={tb.id}
              element={displayTb}
              pageWidth={PAGE_WIDTH}
              pageHeight={PAGE_HEIGHT}
              selected={selectedTextBoxId === tb.id}
              interactive={tool === "text"}
              autoFocus={autoFocusTextBoxId === tb.id}
              onSelect={() => handleTextBoxSelect(tb.id)}
              onCommit={(html, isEmpty) => handleTextBoxCommit(tb.id, html, isEmpty)}
              onMoveEnd={(x, y) => handleTextBoxMoveEnd(tb.id, x, y)}
              onResizeEnd={(width) => handleTextBoxResizeEnd(tb.id, width)}
              onHeightChange={(height) => handleTextBoxHeightChange(tb.id, height)}
              onDelete={() => handleTextBoxDelete(tb.id)}
              onActiveTextEditorChange={onActiveTextEditorChange}
            />
          );
        })}
      </div>

      {/* Blocs de texte de l'aperçu fantôme d'un drag cross-page du Lasso
          (voir CrossPageDragBridge) — coordonnées déjà exactes pour cette
          page, purement un aperçu non interactif (jamais TextBoxOverlay ni
          son éditeur riche ici : juste un rendu HTML statique, léger, pour
          rester fluide pendant le geste). Retiré dès que le fantôme part ou
          que le transfert réel arrive (voir setIncomingSelectionPreview/
          receiveTransferredSelection). */}
      {incomingPreviewTextBoxes.length > 0 && (
        <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
          {incomingPreviewTextBoxes.map((tb) => (
            <div
              key={tb.id}
              className="absolute overflow-hidden rounded-sm border border-dashed"
              style={{
                left: `${(tb.x / PAGE_WIDTH) * 100}%`,
                top: `${(tb.y / PAGE_HEIGHT) * 100}%`,
                width: `${(tb.width / PAGE_WIDTH) * 100}%`,
                borderColor: "rgba(31, 92, 74, 0.85)",
                background: "rgba(31, 92, 74, 0.06)",
                opacity: 0.85,
              }}
              dangerouslySetInnerHTML={{ __html: tb.html || "" }}
            />
          ))}
        </div>
      )}

      {/* Règle : instrument temporaire d'interface, jamais du contenu — voir
          `ruler` (état local, jamais lu par commitDoc/Document). Purement
          visuel : toute l'interaction (déplacer/tourner/accrocher un tracé)
          passe par les gestionnaires de pointeur du canvas ci-dessus, pas
          par cet overlay (`pointer-events: none`). */}
      {rulerActive && ruler && (
        <RulerOverlay ruler={ruler} pageWidth={PAGE_WIDTH} pageHeight={PAGE_HEIGHT} rotating={rulerRotating} />
      )}

      {/* Menu contextuel du Lasso : masqué pendant le geste de déplacement/
          redimensionnement (voir `selectionDragging`) pour ne pas se figer
          dans son ancienne position pendant que la boîte bouge (le menu
          n'a pas besoin de suivre en direct, seulement une fois le geste
          terminé). Jamais du contenu — comme la Règle, purement de l'UI. */}
      {tool === "lasso" &&
        selection &&
        !selectionDragging &&
        (() => {
          const bounds = rawSelectionBounds(selection);
          if (!bounds) return null;
          const leftPct = ((bounds.x0 + bounds.x1) / 2 / PAGE_WIDTH) * 100;
          const topPagePct = (bounds.y0 / PAGE_HEIGHT) * 100;
          const below = topPagePct < 8;
          return (
            <SelectionContextMenu
              leftPct={leftPct}
              topPct={below ? (bounds.y1 / PAGE_HEIGHT) * 100 : topPagePct}
              below={below}
              onCopy={handleSelectionCopy}
              onCut={handleSelectionCut}
              onDuplicate={handleSelectionDuplicate}
              onDelete={handleSelectionDelete}
            />
          );
        })()}

      {debugHoldDetection && (
        <div className="pointer-events-none fixed right-2 top-2 z-50 max-h-[65vh] overflow-y-auto rounded-lg bg-black/80 px-3 py-2 font-mono text-[11px] leading-relaxed text-white">
          <div>pointerType: {debugInfo.current.pointerType}</div>
          <div>outil : {debugInfo.current.tool}</div>
          <div>seuil de maintien : {holdToSnapMs}ms</div>
          <div>
            immobile depuis : {debugInfo.current.elapsedMs}ms (
            {debugInfo.current.elapsedMs >= holdToSnapMs ? "déclenché" : "en cours"})
          </div>
          <div>écart / ancre : {debugInfo.current.distanceFromAnchor}px (tolérance {HOLD_JITTER_TOLERANCE}px)</div>
          <div>dernier résultat : {debugInfo.current.lastResult}</div>
          <div>nb. déclenchements : {debugInfo.current.holdCount}</div>
          <div className="mt-2 border-t border-white/20 pt-2">— Déplacement / zoom (partagés) —</div>
          <div>zoom actuel : {Math.round(zoom * 100)}%</div>
          <div>activePointerId : {String(activePointerId.current)}</div>
          <div>isPanning : {String(isPanning)}</div>
          <div>panState : {panState.current ? "actif" : "null"}</div>
          <div>touchPoints : {touchPoints.current.size}</div>
          <div>pinchState : {pinchState.current ? "actif" : "null"}</div>
          <div>
            scroll actuel : {containerRef.current?.scrollLeft ?? "—"}×{containerRef.current?.scrollTop ?? "—"}
          </div>
          <div>
            scroll max : {containerRef.current ? containerRef.current.scrollWidth - containerRef.current.clientWidth : "—"}×
            {containerRef.current ? containerRef.current.scrollHeight - containerRef.current.clientHeight : "—"}
          </div>
        </div>
      )}

      {PEN_AUDIT && (
        <div className="pointer-events-auto fixed bottom-2 left-2 z-50 flex max-h-[60vh] w-[340px] flex-col rounded-lg bg-black/85 p-2 font-mono text-[10px] leading-snug text-lime-300 shadow-lg">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-semibold text-white">
              PEN-AUDIT — {penAttempts.current.size} tentative(s), {auditLogRef.current.length} événement(s)
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleCopyAuditLog}
                className="rounded bg-white/15 px-2 py-0.5 text-white active:bg-white/30"
              >
                Copier
              </button>
              <button
                type="button"
                onClick={handleClearAuditLog}
                className="rounded bg-white/15 px-2 py-0.5 text-white active:bg-white/30"
              >
                Effacer
              </button>
            </div>
          </div>
          <div className="mb-1 text-white/70">Résumé par tentative</div>
          <div
            ref={auditAttemptsScrollRef}
            className="mb-1 max-h-[22vh] overflow-y-auto whitespace-pre-wrap break-all border-b border-white/20 pb-1"
          >
            {penAttempts.current.size === 0 ? (
              <div className="text-white/50">(aucune tentative — écris avec le Pencil)</div>
            ) : (
              Array.from(penAttempts.current.values()).map((a) => <div key={a.pointerId}>{formatPenAttemptLine(a)}</div>)
            )}
          </div>
          <div className="mb-1 text-white/70">Log brut</div>
          <div ref={auditLogScrollRef} className="flex-1 overflow-y-auto whitespace-pre-wrap break-all">
            {auditLogRef.current.length === 0 ? (
              <div className="text-white/50">(aucun événement pour l&apos;instant)</div>
            ) : (
              auditLogRef.current.map((line, i) => <div key={i}>{line}</div>)
            )}
          </div>
        </div>
      )}
    </div>
  );
});
