"use client";

import { useEffect, useRef } from "react";
import { drawSheetPattern } from "@/lib/notes/canvasUtils";
import type { SheetType } from "@/lib/notes/types";

interface SheetPreviewProps {
  sheetType: SheetType;
  backgroundColor: string;
  ratio: number;
  width?: number;
  className?: string;
}

/** Miniature d'aperçu d'un type de feuille : réutilise le même moteur de
 * rendu que l'éditeur (drawSheetPattern) pour garantir un aperçu fidèle. */
export function SheetPreview({ sheetType, backgroundColor, ratio, width = 96, className }: SheetPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const height = Math.round(width / ratio);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
    drawSheetPattern(ctx, sheetType, width, height, backgroundColor);
  }, [sheetType, backgroundColor, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className={`rounded-md border border-border ${className ?? ""}`}
    />
  );
}
