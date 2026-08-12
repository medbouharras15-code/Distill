"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { NotesCanvas, type NotesCanvasHandle, type NotesTool } from "@/components/notes/NotesCanvas";
import {
  HIGHLIGHTER_COLORS,
  HIGHLIGHTER_SIZES,
  NotesToolbar,
  PEN_COLORS,
  PEN_SIZES,
  SHAPE_COLORS,
  SHAPE_STROKE_WIDTHS,
} from "@/components/notes/NotesToolbar";
import { SheetSelector } from "@/components/notes/SheetSelector";
import { BACKGROUND_COLORS, PAPER_SIZES, SHEET_TYPES } from "@/lib/notes/sheets";
import type { PaperSize, PenType, ShapeType, SheetType } from "@/lib/notes/types";

export default function NotesPage() {
  const canvasHandle = useRef<NotesCanvasHandle | null>(null);

  const [sheetChosen, setSheetChosen] = useState(false);
  const [sheetPanelOpen, setSheetPanelOpen] = useState(false);
  const [sheetType, setSheetType] = useState<SheetType>("plain");
  const [paperSize, setPaperSize] = useState<PaperSize>("letter");
  const [backgroundColor, setBackgroundColor] = useState(BACKGROUND_COLORS[0].value);

  const [tool, setTool] = useState<NotesTool>("pen");
  const [previousTool, setPreviousTool] = useState<NotesTool>("pen");
  const [tempEraser, setTempEraser] = useState(false);

  const [penColor, setPenColor] = useState(PEN_COLORS[0].value);
  const [penSize, setPenSize] = useState(PEN_SIZES[2]);
  const [penType, setPenType] = useState<PenType>("fineliner");

  const [highlighterColor, setHighlighterColor] = useState(HIGHLIGHTER_COLORS[0].value);
  const [highlighterSize, setHighlighterSize] = useState(HIGHLIGHTER_SIZES[2]);

  const [eraserRadius, setEraserRadius] = useState(18);

  const [shapeType, setShapeType] = useState<ShapeType>("rectangle");
  const [shapeColor, setShapeColor] = useState(SHAPE_COLORS[0].value);
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState(SHAPE_STROKE_WIDTHS[2]);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Indicateur de debug temporaire pour le hold-timer : ajouter ?debug=1 à
  // l'URL (ex. sur iPad) pour l'activer sans redéploiement.
  const [debugHoldDetection] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("debug") === "1";
  });

  function selectPen() {
    setTool("pen");
    setTempEraser(false);
  }

  function selectHighlighter() {
    setTool("highlighter");
    setTempEraser(false);
  }

  function selectEraser() {
    setTool("eraser");
    setTempEraser(false);
  }

  function selectShapes() {
    setTool("shapes");
    setTempEraser(false);
  }

  function selectPhoto() {
    setTool("photo");
    setTempEraser(false);
  }

  /** Bascule rapide vers la gomme, avec retour automatique à l'outil
   * précédent après usage — déclenchée par le double-clic sur l'icône
   * stylo ou par un double-tap de la pointe du stylet sur la feuille. */
  function activateTempEraser() {
    if (tool !== "eraser") {
      setPreviousTool(tool);
    }
    setTool("eraser");
    setTempEraser(true);
  }

  function handleActionComplete() {
    if (tempEraser) {
      setTool(previousTool);
      setTempEraser(false);
    }
  }

  const sheetLabel = SHEET_TYPES.find((s) => s.value === sheetType)?.label ?? sheetType;
  const paperLabel = PAPER_SIZES.find((p) => p.value === paperSize)?.label ?? paperSize;

  if (!sheetChosen) {
    return (
      <div
        className="notes-no-callout mx-auto flex min-h-full w-full max-w-4xl select-none flex-col gap-6 px-4 py-6 sm:px-6"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-muted transition hover:text-foreground">
            ← Retour à Distill
          </Link>
          <h1 className="font-display text-lg font-medium text-foreground">Notes à main levée</h1>
          <div className="w-24" />
        </div>

        <SheetSelector
          sheetType={sheetType}
          onSheetTypeChange={setSheetType}
          paperSize={paperSize}
          onPaperSizeChange={setPaperSize}
          backgroundColor={backgroundColor}
          onBackgroundColorChange={setBackgroundColor}
          onConfirm={() => setSheetChosen(true)}
          confirmLabel="Commencer à écrire"
        />
      </div>
    );
  }

  return (
    <div
      className="notes-no-callout mx-auto flex h-dvh w-full max-w-4xl select-none flex-col gap-4 overflow-hidden px-4 py-6 sm:px-6"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-muted transition hover:text-foreground">
          ← Retour à Distill
        </Link>
        <h1 className="font-display text-lg font-medium text-foreground">Notes à main levée</h1>
        <div className="w-24" />
      </div>

      <button
        type="button"
        onClick={() => setSheetPanelOpen(true)}
        className="flex w-fit items-center gap-2 self-center rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
      >
        <span
          className="h-3 w-3 rounded-full border border-border"
          style={{ backgroundColor }}
          aria-hidden="true"
        />
        {sheetLabel} · {paperLabel}
      </button>

      <NotesToolbar
        tool={tool}
        onSelectPen={selectPen}
        onSelectHighlighter={selectHighlighter}
        onSelectEraser={selectEraser}
        onSelectShapes={selectShapes}
        onSelectPhoto={selectPhoto}
        onPenDoubleClick={activateTempEraser}
        onImportPhotos={(files) => canvasHandle.current?.importPhotos(files)}
        penColor={penColor}
        onPenColorChange={setPenColor}
        penSize={penSize}
        onPenSizeChange={setPenSize}
        penType={penType}
        onPenTypeChange={setPenType}
        highlighterColor={highlighterColor}
        onHighlighterColorChange={setHighlighterColor}
        highlighterSize={highlighterSize}
        onHighlighterSizeChange={setHighlighterSize}
        eraserRadius={eraserRadius}
        onEraserRadiusChange={setEraserRadius}
        shapeType={shapeType}
        onShapeTypeChange={setShapeType}
        shapeColor={shapeColor}
        onShapeColorChange={setShapeColor}
        shapeStrokeWidth={shapeStrokeWidth}
        onShapeStrokeWidthChange={setShapeStrokeWidth}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => canvasHandle.current?.undo()}
        onRedo={() => canvasHandle.current?.redo()}
      />

      <div className="min-h-0 w-full flex-1">
        <NotesCanvas
          ref={canvasHandle}
          tool={tool}
          penColor={penColor}
          penSize={penSize}
          penType={penType}
          highlighterColor={highlighterColor}
          highlighterSize={highlighterSize}
          eraserRadius={eraserRadius}
          shapeType={shapeType}
          shapeColor={shapeColor}
          shapeStrokeWidth={shapeStrokeWidth}
          sheetType={sheetType}
          paperSize={paperSize}
          backgroundColor={backgroundColor}
          debugHoldDetection={debugHoldDetection}
          onActionComplete={handleActionComplete}
          onPenDoubleTap={activateTempEraser}
          onHistoryChange={(undo, redo) => {
            setCanUndo(undo);
            setCanRedo(redo);
          }}
        />
      </div>

      {sheetPanelOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSheetPanelOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSheetPanelOpen(false)}
                aria-label="Fermer"
                className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted transition hover:text-foreground"
              >
                ×
              </button>
            </div>
            <SheetSelector
              sheetType={sheetType}
              onSheetTypeChange={setSheetType}
              paperSize={paperSize}
              onPaperSizeChange={setPaperSize}
              backgroundColor={backgroundColor}
              onBackgroundColorChange={setBackgroundColor}
            />
          </div>
        </div>
      )}
    </div>
  );
}
