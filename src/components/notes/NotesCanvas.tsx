"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type {
  ImageElement,
  PaperSize,
  PenType,
  ShapeElement,
  ShapeType,
  SheetType,
  Stroke,
  StrokePoint,
} from "@/lib/notes/types";
import {
  drawImageElement,
  drawImageSelection,
  drawShape,
  drawSheetPattern,
  drawStroke,
  imageHandleHitTest,
  imageHitTest,
  shapeHitTest,
  strokeHitTest,
  type ImageHandle,
} from "@/lib/notes/canvasUtils";
import { getPageDimensions } from "@/lib/notes/sheets";
import { computeSnapTargets, detectFreehandShape, type ShapeDetectionResult } from "@/lib/notes/shapeDetection";
import { ZoomInIcon, ZoomOutIcon } from "./icons";

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

/** Zoom minimum/maximum autorisé sur la feuille (pinch-to-zoom, molette
 * Ctrl+, boutons +/-). */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

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
  shapeType?: ShapeType;
  anchor: { x: number; y: number };
  current: { x: number; y: number };
  color: string;
  size: number;
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
    shapeType: shape.type,
    anchor: { x: anchorX, y: anchorY },
    current: { x: anchorX === x0 ? x1 : x0, y: anchorY === y0 ? y1 : y0 },
    color,
    size,
  };
}

export type NotesTool = "pen" | "highlighter" | "eraser" | "shapes" | "photo" | "pan";

export interface NotesCanvasHandle {
  undo(): void;
  redo(): void;
  importPhotos(files: FileList | File[]): void;
}

interface Document {
  strokes: Stroke[];
  shapes: ShapeElement[];
  images: ImageElement[];
}

interface NotesCanvasProps {
  tool: NotesTool;
  penColor: string;
  penSize: number;
  penType: PenType;
  highlighterColor: string;
  highlighterSize: number;
  eraserRadius: number;
  shapeType: ShapeType;
  shapeColor: string;
  shapeStrokeWidth: number;
  sheetType: SheetType;
  paperSize: PaperSize;
  backgroundColor?: string;
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
}

export const NotesCanvas = forwardRef<NotesCanvasHandle, NotesCanvasProps>(function NotesCanvas(
  {
    tool,
    penColor,
    penSize,
    penType,
    highlighterColor,
    highlighterSize,
    eraserRadius,
    shapeType,
    shapeColor,
    shapeStrokeWidth,
    sheetType,
    paperSize,
    backgroundColor = "#ffffff",
    holdToSnapMs = DEFAULT_HOLD_TO_SNAP_MS,
    debugHoldDetection = false,
    onActionComplete,
    onPenDoubleTap,
    onHistoryChange,
  },
  ref,
) {
  const { width: PAGE_WIDTH, height: PAGE_HEIGHT } = getPageDimensions(paperSize);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [shapes, setShapes] = useState<ShapeElement[]>([]);
  const [images, setImages] = useState<ImageElement[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  const shapesRef = useRef<ShapeElement[]>([]);
  const imagesRef = useRef<ImageElement[]>([]);
  const undoStack = useRef<Document[]>([]);
  const redoStack = useRef<Document[]>([]);

  const activePointerId = useRef<number | null>(null);
  const currentStroke = useRef<Stroke | null>(null);
  const currentShape = useRef<ShapeElement | null>(null);
  const shapeStartPos = useRef<{ x: number; y: number } | null>(null);
  const erasedStrokeIds = useRef<Set<string> | null>(null);
  const erasedShapeIds = useRef<Set<string> | null>(null);
  const erasedImageIds = useRef<Set<string> | null>(null);
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

  /** 1 = 100% = la largeur du canvas correspond exactement à la largeur du
   * conteneur (le zoom est défini en % de la largeur du conteneur, voir le
   * style du canvas plus bas) — la feuille remplit donc tout l'écran en
   * largeur dès l'ouverture, sans calcul, sans marge vide sur les côtés,
   * comme dans la plupart des lecteurs/éditeurs de document ("fit to
   * width"). Si la page est plus haute que l'écran une fois à cette
   * largeur, le surplus se consulte par défilement vertical dans le
   * conteneur (normal pour un document) plutôt que d'être rétréci pour
   * tout faire tenir d'un coup — une version précédente calculait un zoom
   * initial plus petit pour éviter tout défilement vertical, mais cela
   * laissait de larges bandes vides à gauche/droite dès que le conteneur
   * était plus large que haut (écran en paysage, iPad compris). */
  const [zoom, setZoom] = useState(1);
  /** Miroir synchrone de `zoom`, lu par les gestes haute fréquence (pincement,
   * molette) pour calculer le point d'ancrage du zoom suivant. Un simple
   * `useEffect` qui recopie `zoom` dans une ref serait décalé d'un cycle de
   * rendu : de vrais événements tactiles peuvent arriver plus vite que React
   * ne s'exécute (contrairement aux tests automatisés, où chaque événement a
   * le temps d'être traité avant le suivant), donc `applyZoom` met à jour
   * cette ref *en même temps* que l'état, jamais après — sans quoi le calcul
   * du point suivant se base sur un zoom périmé et le zoom part loin du
   * point visé, un décalage d'autant plus visible que le geste est rapide. */
  const zoomRef = useRef(zoom);
  function applyZoom(newZoom: number) {
    zoomRef.current = newZoom;
    setZoom(newZoom);
  }
  const touchPoints = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchState = useRef<{ initialDistance: number; initialZoom: number } | null>(null);
  /** Instantané des dernières mesures de zoom, affiché dans le panneau de
   * debug (`?debug=1`) pour diagnostiquer un écart en conditions réelles
   * (iPad) sans avoir accès à la console. */
  const zoomDebug = useRef({
    containerW: 0,
    containerH: 0,
    canvasW: 0,
    canvasH: 0,
    lastAnchor: "—",
  });

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

    for (const imageEl of imagesRef.current) {
      if (erasedImageIds.current?.has(imageEl.id)) continue;
      const preview = dragPreview.current?.id === imageEl.id ? dragPreview.current : imageEl;
      const img = getOrLoadImage(preview.src);
      if (img) drawImageElement(ctx, preview, img);
    }
    for (const stroke of strokesRef.current) {
      if (erasedStrokeIds.current?.has(stroke.id)) continue;
      drawStroke(ctx, stroke);
    }
    for (const shape of shapesRef.current) {
      if (erasedShapeIds.current?.has(shape.id)) continue;
      drawShape(ctx, shape);
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
      drawStroke(ctx, {
        id: "__snap-anim__",
        tool: "pen",
        penType,
        color: penColor,
        size: penSize,
        points: interpolated,
      });
    } else if (lockedSnap.current) {
      // Forme verrouillée : le stylet n'ajuste plus que `current`, la
      // géométrie (ligne / rectangle / cercle) ne redevient jamais un tracé
      // à main levée.
      const locked = lockedSnap.current;
      if (locked.kind === "line") {
        drawStroke(ctx, {
          id: "__locked__",
          tool: "pen",
          penType: locked.penType ?? "fineliner",
          color: locked.color,
          size: locked.size,
          points: [
            { x: locked.anchor.x, y: locked.anchor.y, pressure: 0.5 },
            { x: locked.current.x, y: locked.current.y, pressure: 0.5 },
          ],
        });
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
      drawStroke(ctx, currentStroke.current);
    }

    if (currentShape.current) {
      drawShape(ctx, currentShape.current);
    }

    if (tool === "photo" && selectedImageId) {
      const selected = imagesRef.current.find((img) => img.id === selectedImageId);
      const previewSelected = dragPreview.current?.id === selectedImageId ? dragPreview.current : selected;
      if (previewSelected) drawImageSelection(ctx, previewSelected);
    }
    // getOrLoadImage volontairement omis des dépendances : il appelle
    // scheduleRender, défini juste après renderAll (référence circulaire),
    // mais ne dépend lui-même que de refs stables (imageCache) donc son
    // identité entre deux rendus n'a aucune incidence sur le comportement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundColor, sheetType, PAGE_WIDTH, PAGE_HEIGHT, penColor, penSize, penType, tool, selectedImageId]);

  const scheduleRender = useCallback(() => {
    if (renderScheduled.current) return;
    renderScheduled.current = true;
    requestAnimationFrame(() => {
      renderScheduled.current = false;
      renderAll();
    });
  }, [renderAll]);

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
  function scheduleHoldCheck(pos: { x: number; y: number }) {
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
      if (result) {
        lockedSnap.current = deriveLockedSnap(result, snapshotPoints[0] ?? pos, penColor, penSize, penType);
        startSnapAnimation(snapshotPoints, result);
      }
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

  /** Change le zoom en gardant fixe, à l'écran, le point de contenu qui se
   * trouve sous (clientX, clientY) — pincement à deux doigts, molette
   * Ctrl+, ou boutons +/- (centrés sur le milieu de la zone visible).
   *
   * Applique la largeur du canvas ET le défilement corrigé de façon
   * *synchrone*, en DOM direct, plutôt que de laisser React re-rendre puis
   * corriger le défilement dans un `useLayoutEffect` ultérieur. C'est
   * essentiel : un vrai pincement tactile envoie des `pointermove` bien
   * plus vite que React ne peut re-rendre entre deux. Avec l'ancienne
   * version (état React + effet différé), plusieurs appels pouvaient
   * s'enchaîner avant qu'aucun ne soit réellement peint — le calcul du
   * point suivant se basait alors sur une largeur de canvas "prévue" mais
   * jamais rendue, pendant que `scrollLeft` restait lui bloqué sur la
   * toute dernière valeur réellement peinte : le point de contenu visé et
   * le point réellement gardé sous le doigt divergeaient au fil du geste,
   * produisant un grand écart. En écrivant `canvas.style.width` et
   * `container.scrollLeft` nous-mêmes, dans la même passe, chaque appel
   * repart d'un état garanti cohérent (le nôtre), qu'il ait ou non été
   * repeint par le navigateur entre-temps. `setZoom` ne sert plus alors
   * qu'à synchroniser l'état React (étiquette de %, re-rendu éventuel),
   * jamais comme source de vérité pendant le geste. Invisible dans des
   * tests avec un délai entre chaque événement (le rendu a toujours le
   * temps de se faire), mais déterminant sur un vrai écran tactile. */
  const zoomAtPoint = useCallback(
    (newZoomRaw: number, clientX: number, clientY: number) => {
      const clamped = clamp(newZoomRaw, MIN_ZOOM, MAX_ZOOM);
      const container = containerRef.current;
      const canvas = canvasRef.current;
      const currentZoom = zoomRef.current;
      if (!container || !canvas) {
        applyZoom(clamped);
        return;
      }

      const rect = container.getBoundingClientRect();
      const pointerX = clientX - rect.left;
      const pointerY = clientY - rect.top;
      const containerWidth = container.clientWidth;
      const oldCanvasWidth = containerWidth * currentZoom;
      const oldCanvasHeight = oldCanvasWidth * (PAGE_HEIGHT / PAGE_WIDTH);
      // En dessous de 100%, le canvas est centré horizontalement
      // (`mx-auto`) plutôt que collé au bord gauche — pour que le fond de
      // page redevienne visible tout autour dès qu'on dézoome
      // volontairement, et qu'on voie clairement où la feuille s'arrête. Il
      // faut donc décaler d'autant le calcul du point de contenu visé (sans
      // ce décalage, un pincement en dessous de 100% viserait un point
      // erroné, translaté de la largeur de la marge de centrage).
      const oldOffsetX = Math.max(0, (containerWidth - oldCanvasWidth) / 2);
      const contentX = container.scrollLeft + pointerX - oldOffsetX;
      const contentY = container.scrollTop + pointerY;
      const fracX = oldCanvasWidth > 0 ? contentX / oldCanvasWidth : 0.5;
      const fracY = oldCanvasHeight > 0 ? contentY / oldCanvasHeight : 0.5;

      const newCanvasWidth = containerWidth * clamped;
      const newCanvasHeight = newCanvasWidth * (PAGE_HEIGHT / PAGE_WIDTH);
      const newOffsetX = Math.max(0, (containerWidth - newCanvasWidth) / 2);
      canvas.style.width = `${clamped * 100}%`;
      container.scrollLeft = fracX * newCanvasWidth - pointerX + newOffsetX;
      container.scrollTop = fracY * newCanvasHeight - pointerY;

      if (debugHoldDetection) {
        zoomDebug.current.lastAnchor = `frac(${fracX.toFixed(2)}, ${fracY.toFixed(2)}) pointer(${Math.round(pointerX)}, ${Math.round(pointerY)}) zoom ${Math.round(currentZoom * 100)}→${Math.round(clamped * 100)}%`;
      }
      applyZoom(clamped);
    },
    [PAGE_WIDTH, PAGE_HEIGHT, debugHoldDetection],
  );

  // Mesures affichées dans le panneau de debug — mises à jour à chaque
  // rendu (le tick périodique du panneau, voir plus haut, force ces
  // re-lectures même quand rien d'autre ne change).
  useEffect(() => {
    if (!debugHoldDetection) return;
    const container = containerRef.current;
    if (container) {
      zoomDebug.current.containerW = Math.round(container.clientWidth);
      zoomDebug.current.containerH = Math.round(container.clientHeight);
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      zoomDebug.current.canvasW = Math.round(rect.width);
      zoomDebug.current.canvasH = Math.round(rect.height);
    }
  });

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
      zoomAtPoint(zoomRef.current - e.deltaY * 0.01, e.clientX, e.clientY);
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [zoomAtPoint]);

  const commitDoc = useCallback(
    (next: Document) => {
      undoStack.current.push({ strokes: strokesRef.current, shapes: shapesRef.current, images: imagesRef.current });
      redoStack.current = [];
      strokesRef.current = next.strokes;
      shapesRef.current = next.shapes;
      imagesRef.current = next.images;
      setStrokes(next.strokes);
      setShapes(next.shapes);
      setImages(next.images);
      notifyHistory();
    },
    [notifyHistory],
  );

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    redoStack.current.push({ strokes: strokesRef.current, shapes: shapesRef.current, images: imagesRef.current });
    strokesRef.current = prev.strokes;
    shapesRef.current = prev.shapes;
    imagesRef.current = prev.images;
    setStrokes(prev.strokes);
    setShapes(prev.shapes);
    setImages(prev.images);
    notifyHistory();
  }, [notifyHistory]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push({ strokes: strokesRef.current, shapes: shapesRef.current, images: imagesRef.current });
    strokesRef.current = next.strokes;
    shapesRef.current = next.shapes;
    imagesRef.current = next.images;
    setStrokes(next.strokes);
    setShapes(next.shapes);
    setImages(next.images);
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
      commitDoc({ strokes: strokesRef.current, shapes: shapesRef.current, images: nextImages });
      setSelectedImageId(newImages[newImages.length - 1].id);
    },
    [PAGE_WIDTH, PAGE_HEIGHT, commitDoc],
  );

  useImperativeHandle(ref, () => ({ undo, redo, importPhotos }), [undo, redo, importPhotos]);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>): StrokePoint {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = PAGE_WIDTH / rect.width;
    const scaleY = PAGE_HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  }

  function eraseAt(pos: StrokePoint) {
    if (!erasedStrokeIds.current || !erasedShapeIds.current || !erasedImageIds.current) return;
    let changed = false;
    for (const stroke of strokesRef.current) {
      if (erasedStrokeIds.current.has(stroke.id)) continue;
      if (strokeHitTest(stroke, pos.x, pos.y, eraserRadius)) {
        erasedStrokeIds.current.add(stroke.id);
        changed = true;
      }
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
    // On ne retire les éléments effacés de strokesRef/shapesRef/imagesRef
    // qu'au commit final (endStroke) — pas ici — afin que ces refs
    // conservent l'état "avant effacement" jusque-là : commitDoc s'en sert
    // pour construire l'instantané que l'annulation doit restaurer. Le
    // rendu masque déjà les éléments marqués comme effacés (voir renderAll),
    // donc l'aperçu visuel reste correct sans cette mutation anticipée.
    if (changed) {
      scheduleRender();
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "touch") {
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
        imageDragMode.current = null;
        dragPreview.current = null;
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
        return;
      }
    }

    if (tool !== "pan" && e.pointerType === "touch" && Date.now() - lastPenTime.current < PALM_REJECTION_MS) {
      // Rejet de paume : on ignore ce contact tactile pendant l'écriture au
      // stylet — sauf avec l'outil Déplacement, explicitement choisi pour
      // naviguer et qui ne dessine jamais rien.
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
    activePointerId.current = e.pointerId;
    const pos = getPos(e);

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
      eraseAt(pos);
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
      const list = imagesRef.current;
      let handled = false;

      // On teste d'abord les poignées de l'image déjà sélectionnée (elles
      // doivent rester prioritaires même si elles chevauchent une autre photo).
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
            handled = true;
          }
        }
      }

      if (!handled) {
        for (let i = list.length - 1; i >= 0; i--) {
          if (imageHitTest(list[i], pos.x, pos.y, 4)) {
            setSelectedImageId(list[i].id);
            imageDragMode.current = {
              id: list[i].id,
              mode: "move",
              startPos: { x: pos.x, y: pos.y },
              startElement: { ...list[i] },
            };
            handled = true;
            break;
          }
        }
      }

      if (!handled) {
        setSelectedImageId(null);
        imageDragMode.current = null;
      }
      scheduleRender();
    } else if (tool === "pan") {
      const container = containerRef.current;
      panState.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startScrollLeft: container ? container.scrollLeft : 0,
        startScrollTop: container ? container.scrollTop : 0,
      };
      setIsPanning(true);
    } else if (tool === "highlighter") {
      currentStroke.current = {
        id: crypto.randomUUID(),
        tool: "highlighter",
        color: highlighterColor,
        size: highlighterSize,
        points: [pos],
      };
      scheduleRender();
    } else {
      currentStroke.current = {
        id: crypto.randomUUID(),
        tool: "pen",
        penType,
        color: penColor,
        size: penSize,
        points: [pos],
      };
      scheduleHoldCheck(pos);
      scheduleRender();
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
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
        zoomAtPoint(pinchState.current.initialZoom * ratio, midX, midY);
        return;
      }
    }

    if (activePointerId.current !== e.pointerId) return;
    if (e.pointerType === "pen") {
      lastPenTime.current = Date.now();
    }
    const pos = getPos(e);

    if (tapIsCandidate.current && tapStartInfo.current) {
      const start = tapStartInfo.current;
      if (Math.hypot(pos.x - start.x, pos.y - start.y) > TAP_MAX_MOVEMENT) {
        tapIsCandidate.current = false;
      }
    }

    if (tool === "pan") {
      if (panState.current) {
        const container = containerRef.current;
        if (container) {
          container.scrollLeft = panState.current.startScrollLeft - (e.clientX - panState.current.startClientX);
          container.scrollTop = panState.current.startScrollTop - (e.clientY - panState.current.startClientY);
        }
      }
      return;
    }

    if (tool === "eraser") {
      eraseAt(pos);
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
      if (imageDragMode.current) {
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
        // seul le commit final au relâchement doit modifier la référence,
        // sans quoi l'instantané "avant" de l'annulation serait déjà pollué
        // par le déplacement en cours (même bug que l'ancienne gomme).
        dragPreview.current = { ...next, id };
        scheduleRender();
      }
      return;
    }

    if (!currentStroke.current) return;

    if (tool === "pen" && lockedSnap.current) {
      // Verrouillé : la géométrie ne bouge plus jamais — le stylet
      // n'ajuste plus que le point d'arrivée (ligne) ou le coin opposé à
      // l'ancrage (cercle/rectangle).
      lockedSnap.current = { ...lockedSnap.current, current: { x: pos.x, y: pos.y } };
      snapAnimation.current = null;
      scheduleRender();
      return;
    }

    currentStroke.current.points.push(pos);

    if (tool === "pen") {
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
        scheduleHoldCheck(pos);
      }
      // Sinon, gigue tolérée : on laisse le minuteur déjà armé continuer sans
      // le réinitialiser, pour qu'il puisse effectivement arriver à son terme.
    }

    scheduleRender();
  }

  function endStroke() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    holdAnchorPos.current = null;

    if (tool === "pan") {
      panState.current = null;
      setIsPanning(false);
      activePointerId.current = null;
      onActionComplete?.();
      return;
    }

    if (tool === "eraser") {
      const hasErasedStrokes = !!erasedStrokeIds.current && erasedStrokeIds.current.size > 0;
      const hasErasedShapes = !!erasedShapeIds.current && erasedShapeIds.current.size > 0;
      const hasErasedImages = !!erasedImageIds.current && erasedImageIds.current.size > 0;
      if (hasErasedStrokes || hasErasedShapes || hasErasedImages) {
        // strokesRef/shapesRef/imagesRef sont encore l'état "avant
        // effacement" à ce stade (eraseAt ne les mutait pas) : on calcule
        // les tableaux filtrés ici, pour committer, sans jamais avoir
        // modifié les refs avant que commitDoc n'y lise son instantané
        // "avant" pour la pile d'annulation.
        const nextStrokes = hasErasedStrokes
          ? strokesRef.current.filter((s) => !erasedStrokeIds.current!.has(s.id))
          : strokesRef.current;
        const nextShapes = hasErasedShapes
          ? shapesRef.current.filter((s) => !erasedShapeIds.current!.has(s.id))
          : shapesRef.current;
        const nextImages = hasErasedImages
          ? imagesRef.current.filter((i) => !erasedImageIds.current!.has(i.id))
          : imagesRef.current;
        commitDoc({ strokes: nextStrokes, shapes: nextShapes, images: nextImages });
      }
      erasedStrokeIds.current = null;
      erasedShapeIds.current = null;
      erasedImageIds.current = null;
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
        commitDoc({ strokes: strokesRef.current, shapes: [...shapesRef.current, shape], images: imagesRef.current });
      }
      scheduleRender();
      onActionComplete?.();
      return;
    }

    if (tool === "photo") {
      const preview = dragPreview.current;
      imageDragMode.current = null;
      dragPreview.current = null;
      activePointerId.current = null;
      if (preview) {
        const nextImages = imagesRef.current.map((img) => (img.id === preview.id ? preview : img));
        commitDoc({ strokes: strokesRef.current, shapes: shapesRef.current, images: nextImages });
      }
      scheduleRender();
      onActionComplete?.();
      return;
    }

    const finished = currentStroke.current;
    currentStroke.current = null;
    activePointerId.current = null;

    const locked = lockedSnap.current;
    lockedSnap.current = null;
    snapAnimation.current = null;

    if (locked) {
      if (locked.kind === "line") {
        const stroke: Stroke = {
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
        commitDoc({ strokes: [...strokesRef.current, stroke], shapes: shapesRef.current, images: imagesRef.current });
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
        commitDoc({ strokes: strokesRef.current, shapes: [...shapesRef.current, shape], images: imagesRef.current });
      }
      tapStartInfo.current = null;
      lastTap.current = null;
      scheduleRender();
      onActionComplete?.();
      return;
    }

    if (!finished) {
      scheduleRender();
      return;
    }

    const start = tapStartInfo.current;
    const duration = start ? Date.now() - start.time : Infinity;
    const isTap = tapIsCandidate.current && start !== null && duration <= TAP_MAX_DURATION_MS;
    tapStartInfo.current = null;

    if (isTap && start) {
      const last = lastTap.current;
      const isDoubleTap =
        last !== null &&
        Date.now() - last.time <= DOUBLE_TAP_MAX_INTERVAL_MS &&
        Math.hypot(start.x - last.x, start.y - last.y) <= DOUBLE_TAP_MAX_DISTANCE;

      if (isDoubleTap) {
        // Double-tap détecté : on annule ce tout petit trait (le point qui
        // aurait été laissé par ce second tap) et on déclenche la bascule
        // vers la gomme plutôt que de committer un trait.
        lastTap.current = null;
        scheduleRender();
        onPenDoubleTap?.();
        return;
      }
      lastTap.current = { x: start.x, y: start.y, time: Date.now() };
    } else {
      lastTap.current = null;
    }

    if (finished.points.length > 0) {
      commitDoc({ strokes: [...strokesRef.current, finished], shapes: shapesRef.current, images: imagesRef.current });
    }
    scheduleRender();
    onActionComplete?.();
  }

  function endPinchIfDone(pointerId: number) {
    touchPoints.current.delete(pointerId);
    if (touchPoints.current.size < 2) pinchState.current = null;
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "touch") endPinchIfDone(e.pointerId);
    if (activePointerId.current !== e.pointerId) return;
    endStroke();
  }

  function handlePointerCancel(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "touch") endPinchIfDone(e.pointerId);
    if (activePointerId.current !== e.pointerId) return;
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    currentStroke.current = null;
    currentShape.current = null;
    shapeStartPos.current = null;
    lockedSnap.current = null;
    snapAnimation.current = null;
    holdAnchorPos.current = null;
    erasedStrokeIds.current = null;
    erasedShapeIds.current = null;
    erasedImageIds.current = null;
    imageDragMode.current = null;
    dragPreview.current = null;
    panState.current = null;
    setIsPanning(false);
    activePointerId.current = null;
    tapStartInfo.current = null;
    tapIsCandidate.current = false;
    scheduleRender();
  }

  /** Zoom via les boutons +/- : centré sur le milieu de la zone visible
   * actuelle plutôt que de recentrer ailleurs (même logique de point fixe
   * que le pincement et la molette, appliquée au centre de l'écran faute
   * d'un point de geste explicite). */
  function zoomByButton(delta: number) {
    const container = containerRef.current;
    if (!container) {
      applyZoom(clamp(zoomRef.current + delta, MIN_ZOOM, MAX_ZOOM));
      return;
    }
    const rect = container.getBoundingClientRect();
    zoomAtPoint(zoomRef.current + delta, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function resetZoom() {
    applyZoom(1);
    const container = containerRef.current;
    if (container) {
      container.scrollLeft = 0;
      container.scrollTop = 0;
    }
  }

  return (
    <div
      className="relative h-full w-full"
      style={{
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
    >
      <div
        ref={containerRef}
        className="h-full w-full overflow-auto"
        style={{ touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: `${zoom * 100}%`,
            height: "auto",
            aspectRatio: `${PAGE_WIDTH} / ${PAGE_HEIGHT}`,
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
          className="mx-auto bg-card"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerCancel}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* Le canvas défile désormais dans son propre conteneur borné à la
          taille de l'écran (voir ci-dessus) plutôt que dans la page entière
          — les contrôles restent donc bien ancrés au coin de cette zone. */}
      <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex w-fit items-center gap-1 rounded-full border border-border bg-card/95 px-1.5 py-1 shadow-sm">
        <button
          type="button"
          onClick={() => zoomByButton(-0.25)}
          aria-label="Zoom arrière"
          title="Zoom arrière"
          className="pointer-events-auto grid h-7 w-7 place-items-center rounded-full text-foreground transition hover:bg-background-alt"
        >
          <ZoomOutIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={resetZoom}
          aria-label="Réinitialiser le zoom"
          title="Réinitialiser le zoom (100%, pleine largeur)"
          className="pointer-events-auto min-w-[3rem] rounded-full px-1 text-center text-[11px] font-medium text-muted transition hover:bg-background-alt hover:text-foreground"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => zoomByButton(0.25)}
          aria-label="Zoom avant"
          title="Zoom avant"
          className="pointer-events-auto grid h-7 w-7 place-items-center rounded-full text-foreground transition hover:bg-background-alt"
        >
          <ZoomInIcon className="h-4 w-4" />
        </button>
      </div>

      {debugHoldDetection && (
        <div className="pointer-events-none absolute left-2 top-2 rounded-lg bg-black/80 px-3 py-2 font-mono text-[11px] leading-relaxed text-white">
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
          <div className="mt-2 border-t border-white/20 pt-2">— Zoom —</div>
          <div>zoom actuel : {Math.round(zoom * 100)}%</div>
          <div>
            conteneur : {zoomDebug.current.containerW}×{zoomDebug.current.containerH}px
          </div>
          <div>
            canvas affiché : {zoomDebug.current.canvasW}×{zoomDebug.current.canvasH}px
          </div>
          <div>dernier ancrage : {zoomDebug.current.lastAnchor}</div>
        </div>
      )}
    </div>
  );
});
