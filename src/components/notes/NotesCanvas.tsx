"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { PaperSize, PenType, ShapeElement, ShapeType, SheetType, Stroke, StrokePoint } from "@/lib/notes/types";
import { drawShape, drawSheetPattern, drawStroke, shapeHitTest, strokeHitTest } from "@/lib/notes/canvasUtils";
import { getPageDimensions } from "@/lib/notes/sheets";
import { computeSnapTargets, detectFreehandShape, type ShapeDetectionResult } from "@/lib/notes/shapeDetection";

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

export type NotesTool = "pen" | "highlighter" | "eraser" | "shapes";

export interface NotesCanvasHandle {
  undo(): void;
  redo(): void;
}

interface Document {
  strokes: Stroke[];
  shapes: ShapeElement[];
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

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [shapes, setShapes] = useState<ShapeElement[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  const shapesRef = useRef<ShapeElement[]>([]);
  const undoStack = useRef<Document[]>([]);
  const redoStack = useRef<Document[]>([]);

  const activePointerId = useRef<number | null>(null);
  const currentStroke = useRef<Stroke | null>(null);
  const currentShape = useRef<ShapeElement | null>(null);
  const shapeStartPos = useRef<{ x: number; y: number } | null>(null);
  const erasedStrokeIds = useRef<Set<string> | null>(null);
  const erasedShapeIds = useRef<Set<string> | null>(null);
  const lastPenTime = useRef(0);
  const renderScheduled = useRef(false);

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

    for (const stroke of strokesRef.current) {
      drawStroke(ctx, stroke);
    }
    for (const shape of shapesRef.current) {
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
  }, [backgroundColor, sheetType, PAGE_WIDTH, PAGE_HEIGHT, penColor, penSize, penType]);

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
  }, [strokes, shapes, backgroundColor, scheduleRender]);

  function commitDoc(next: Document) {
    undoStack.current.push({ strokes: strokesRef.current, shapes: shapesRef.current });
    redoStack.current = [];
    strokesRef.current = next.strokes;
    shapesRef.current = next.shapes;
    setStrokes(next.strokes);
    setShapes(next.shapes);
    notifyHistory();
  }

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    redoStack.current.push({ strokes: strokesRef.current, shapes: shapesRef.current });
    strokesRef.current = prev.strokes;
    shapesRef.current = prev.shapes;
    setStrokes(prev.strokes);
    setShapes(prev.shapes);
    notifyHistory();
  }, [notifyHistory]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push({ strokes: strokesRef.current, shapes: shapesRef.current });
    strokesRef.current = next.strokes;
    shapesRef.current = next.shapes;
    setStrokes(next.strokes);
    setShapes(next.shapes);
    notifyHistory();
  }, [notifyHistory]);

  useImperativeHandle(ref, () => ({ undo, redo }), [undo, redo]);

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
    if (!erasedStrokeIds.current || !erasedShapeIds.current) return;
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
    if (changed) {
      strokesRef.current = strokesRef.current.filter((s) => !erasedStrokeIds.current!.has(s.id));
      shapesRef.current = shapesRef.current.filter((s) => !erasedShapeIds.current!.has(s.id));
      scheduleRender();
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "touch" && Date.now() - lastPenTime.current < PALM_REJECTION_MS) {
      // Rejet de paume : on ignore ce contact tactile pendant l'écriture au stylet.
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

    if (tool === "eraser") {
      const hasErasedStrokes = !!erasedStrokeIds.current && erasedStrokeIds.current.size > 0;
      const hasErasedShapes = !!erasedShapeIds.current && erasedShapeIds.current.size > 0;
      if (hasErasedStrokes || hasErasedShapes) {
        commitDoc({ strokes: strokesRef.current, shapes: shapesRef.current });
      }
      erasedStrokeIds.current = null;
      erasedShapeIds.current = null;
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
        commitDoc({ strokes: strokesRef.current, shapes: [...shapesRef.current, shape] });
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
        commitDoc({ strokes: [...strokesRef.current, stroke], shapes: shapesRef.current });
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
        commitDoc({ strokes: strokesRef.current, shapes: [...shapesRef.current, shape] });
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
      commitDoc({ strokes: [...strokesRef.current, finished], shapes: shapesRef.current });
    }
    scheduleRender();
    onActionComplete?.();
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerId.current !== e.pointerId) return;
    endStroke();
  }

  function handlePointerCancel(e: React.PointerEvent<HTMLCanvasElement>) {
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
    activePointerId.current = null;
    tapStartInfo.current = null;
    tapIsCandidate.current = false;
    scheduleRender();
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "auto",
          aspectRatio: `${PAGE_WIDTH} / ${PAGE_HEIGHT}`,
          touchAction: "none",
          cursor: tool === "eraser" ? "cell" : "crosshair",
          display: "block",
        }}
        className="rounded-xl border border-border bg-card shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
      />
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
        </div>
      )}
    </div>
  );
});
