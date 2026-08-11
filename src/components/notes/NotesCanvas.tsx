"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { PenType, Stroke, StrokePoint } from "@/lib/notes/types";
import { drawStroke, strokeHitTest } from "@/lib/notes/canvasUtils";

export const PAGE_WIDTH = 850;
export const PAGE_HEIGHT = 1100;

/** Durée pendant laquelle on ignore le tactile après une entrée stylet, pour
 * éviter que la paume de la main ne dessine pendant l'écriture. */
const PALM_REJECTION_MS = 750;

export type NotesTool = "pen" | "eraser";

export interface NotesCanvasHandle {
  undo(): void;
  redo(): void;
}

interface NotesCanvasProps {
  tool: NotesTool;
  penColor: string;
  penSize: number;
  penType: PenType;
  eraserRadius: number;
  backgroundColor?: string;
  /** Appelé après chaque trait terminé (dessiné ou effacé). */
  onActionComplete?: () => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
}

export const NotesCanvas = forwardRef<NotesCanvasHandle, NotesCanvasProps>(function NotesCanvas(
  { tool, penColor, penSize, penType, eraserRadius, backgroundColor = "#ffffff", onActionComplete, onHistoryChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  const undoStack = useRef<Stroke[][]>([]);
  const redoStack = useRef<Stroke[][]>([]);

  const activePointerId = useRef<number | null>(null);
  const currentStroke = useRef<Stroke | null>(null);
  const erasedIds = useRef<Set<string> | null>(null);
  const lastPenTime = useRef(0);
  const renderScheduled = useRef(false);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  const notifyHistory = useCallback(() => {
    onHistoryChange?.(undoStack.current.length > 0, redoStack.current.length > 0);
  }, [onHistoryChange]);

  const renderAll = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    for (const stroke of strokesRef.current) {
      drawStroke(ctx, stroke);
    }
    if (currentStroke.current) {
      drawStroke(ctx, currentStroke.current);
    }
  }, [backgroundColor]);

  const scheduleRender = useCallback(() => {
    if (renderScheduled.current) return;
    renderScheduled.current = true;
    requestAnimationFrame(() => {
      renderScheduled.current = false;
      renderAll();
    });
  }, [renderAll]);

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
  }, [renderAll]);

  useEffect(() => {
    scheduleRender();
  }, [strokes, backgroundColor, scheduleRender]);

  function commit(next: Stroke[]) {
    undoStack.current.push(strokesRef.current);
    redoStack.current = [];
    strokesRef.current = next;
    setStrokes(next);
    notifyHistory();
  }

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    redoStack.current.push(strokesRef.current);
    strokesRef.current = prev;
    setStrokes(prev);
    notifyHistory();
  }, [notifyHistory]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(strokesRef.current);
    strokesRef.current = next;
    setStrokes(next);
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
    if (!erasedIds.current) return;
    let changed = false;
    for (const stroke of strokesRef.current) {
      if (erasedIds.current.has(stroke.id)) continue;
      if (strokeHitTest(stroke, pos.x, pos.y, eraserRadius)) {
        erasedIds.current.add(stroke.id);
        changed = true;
      }
    }
    if (changed) {
      strokesRef.current = strokesRef.current.filter((s) => !erasedIds.current!.has(s.id));
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

    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerId.current = e.pointerId;
    const pos = getPos(e);

    if (tool === "eraser") {
      erasedIds.current = new Set();
      eraseAt(pos);
    } else {
      currentStroke.current = {
        id: crypto.randomUUID(),
        tool: "pen",
        penType,
        color: penColor,
        size: penSize,
        points: [pos],
      };
      scheduleRender();
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerId.current !== e.pointerId) return;
    if (e.pointerType === "pen") {
      lastPenTime.current = Date.now();
    }
    const pos = getPos(e);

    if (tool === "eraser") {
      eraseAt(pos);
    } else if (currentStroke.current) {
      currentStroke.current.points.push(pos);
      scheduleRender();
    }
  }

  function endStroke() {
    if (tool === "eraser") {
      if (erasedIds.current && erasedIds.current.size > 0) {
        commit(strokesRef.current);
      }
      erasedIds.current = null;
    } else if (currentStroke.current) {
      const finished = currentStroke.current;
      currentStroke.current = null;
      if (finished.points.length > 0) {
        commit([...strokesRef.current, finished]);
      }
    }
    activePointerId.current = null;
    scheduleRender();
    onActionComplete?.();
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerId.current !== e.pointerId) return;
    endStroke();
  }

  function handlePointerCancel(e: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerId.current !== e.pointerId) return;
    currentStroke.current = null;
    erasedIds.current = null;
    activePointerId.current = null;
    scheduleRender();
  }

  return (
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
  );
});
