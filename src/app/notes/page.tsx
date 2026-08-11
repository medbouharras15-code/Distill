"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { NotesCanvas, type NotesCanvasHandle, type NotesTool } from "@/components/notes/NotesCanvas";
import { NotesToolbar, PEN_COLORS } from "@/components/notes/NotesToolbar";
import type { PenType } from "@/lib/notes/types";

export default function NotesPage() {
  const canvasHandle = useRef<NotesCanvasHandle | null>(null);

  const [tool, setTool] = useState<NotesTool>("pen");
  const [previousTool, setPreviousTool] = useState<NotesTool>("pen");
  const [tempEraser, setTempEraser] = useState(false);

  const [penColor, setPenColor] = useState(PEN_COLORS[0].value);
  const [penSize, setPenSize] = useState(4.5);
  const [penType, setPenType] = useState<PenType>("fineliner");
  const [eraserRadius, setEraserRadius] = useState(12);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  function selectPen() {
    setTool("pen");
    setTempEraser(false);
  }

  function selectEraser() {
    setTool("eraser");
    setTempEraser(false);
  }

  function handlePenDoubleClick() {
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

  return (
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-muted transition hover:text-foreground">
          ← Retour à Distill
        </Link>
        <h1 className="font-display text-lg font-medium text-foreground">Notes à main levée</h1>
        <div className="w-24" />
      </div>

      <NotesToolbar
        tool={tool}
        onSelectPen={selectPen}
        onSelectEraser={selectEraser}
        onPenDoubleClick={handlePenDoubleClick}
        penColor={penColor}
        onPenColorChange={setPenColor}
        penSize={penSize}
        onPenSizeChange={setPenSize}
        penType={penType}
        onPenTypeChange={setPenType}
        eraserRadius={eraserRadius}
        onEraserRadiusChange={setEraserRadius}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => canvasHandle.current?.undo()}
        onRedo={() => canvasHandle.current?.redo()}
      />

      <div className="mx-auto w-full max-w-2xl">
        <NotesCanvas
          ref={canvasHandle}
          tool={tool}
          penColor={penColor}
          penSize={penSize}
          penType={penType}
          eraserRadius={eraserRadius}
          onActionComplete={handleActionComplete}
          onHistoryChange={(undo, redo) => {
            setCanUndo(undo);
            setCanRedo(redo);
          }}
        />
      </div>
    </div>
  );
}
