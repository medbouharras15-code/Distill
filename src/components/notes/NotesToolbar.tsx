"use client";

import type { PenType } from "@/lib/notes/types";
import type { NotesTool } from "./NotesCanvas";

export const PEN_COLORS: { label: string; value: string }[] = [
  { label: "Noir", value: "#1f1b16" },
  { label: "Vert", value: "#2f6b4f" },
  { label: "Rouge", value: "#a83e35" },
];

const PEN_SIZES: { label: string; value: number }[] = [
  { label: "Fine", value: 2 },
  { label: "Normale", value: 4.5 },
  { label: "Grande", value: 8 },
];

const PEN_TYPES: { label: string; value: PenType }[] = [
  { label: "Fine liner", value: "fineliner" },
  { label: "Stylo bille", value: "ballpoint" },
  { label: "Feutre pinceau", value: "brush" },
];

const ERASER_SIZES: { label: string; value: number }[] = [
  { label: "Fine", value: 6 },
  { label: "Moyenne", value: 12 },
  { label: "Grande", value: 20 },
  { label: "Très grande", value: 32 },
];

interface NotesToolbarProps {
  tool: NotesTool;
  onSelectPen: () => void;
  onSelectEraser: () => void;
  onPenDoubleClick: () => void;

  penColor: string;
  onPenColorChange: (color: string) => void;
  penSize: number;
  onPenSizeChange: (size: number) => void;
  penType: PenType;
  onPenTypeChange: (type: PenType) => void;

  eraserRadius: number;
  onEraserRadiusChange: (radius: number) => void;

  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function NotesToolbar({
  tool,
  onSelectPen,
  onSelectEraser,
  onPenDoubleClick,
  penColor,
  onPenColorChange,
  penSize,
  onPenSizeChange,
  penType,
  onPenTypeChange,
  eraserRadius,
  onEraserRadiusChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: NotesToolbarProps) {
  const isCustomColor = !PEN_COLORS.some((c) => c.value === penColor);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Annuler"
          title="Annuler"
          className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground transition hover:bg-background-alt disabled:opacity-30"
        >
          ↺
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Rétablir"
          title="Rétablir"
          className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground transition hover:bg-background-alt disabled:opacity-30"
        >
          ↻
        </button>
      </div>

      <div className="h-8 w-px bg-border" />

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onSelectPen}
          onDoubleClick={onPenDoubleClick}
          aria-pressed={tool === "pen"}
          title="Stylo (double-clic : gomme rapide)"
          className={`grid h-9 w-9 place-items-center rounded-full border text-lg transition ${
            tool === "pen"
              ? "border-accent bg-accent-light text-accent-dark"
              : "border-border text-foreground hover:bg-background-alt"
          }`}
        >
          ✎
        </button>
        <button
          type="button"
          onClick={onSelectEraser}
          aria-pressed={tool === "eraser"}
          title="Gomme"
          className={`grid h-9 w-9 place-items-center rounded-full border text-lg transition ${
            tool === "eraser"
              ? "border-accent bg-accent-light text-accent-dark"
              : "border-border text-foreground hover:bg-background-alt"
          }`}
        >
          ⌫
        </button>
      </div>

      <div className="h-8 w-px bg-border" />

      {tool === "pen" ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            {PEN_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => onPenColorChange(c.value)}
                aria-label={c.label}
                title={c.label}
                className={`h-7 w-7 rounded-full border-2 transition ${
                  penColor === c.value ? "border-accent scale-110" : "border-border"
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}

            <span className="relative h-7 w-7" title="Palette complète">
              <input
                type="color"
                value={penColor}
                onChange={(e) => onPenColorChange(e.target.value)}
                aria-label="Choisir une couleur personnalisée"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 grid place-items-center rounded-full border-2 transition ${
                  isCustomColor ? "border-accent scale-110" : "border-border"
                }`}
                style={{
                  background: isCustomColor
                    ? penColor
                    : "conic-gradient(from 90deg, #a83e35, #d4a13a, #2f6b4f, #3d6fa8, #7451a8, #a83e35)",
                }}
              />
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-full border border-border bg-background-alt p-1">
            {PEN_SIZES.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => onPenSizeChange(s.value)}
                title={s.label}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  penSize === s.value ? "bg-card text-accent-dark shadow-sm" : "text-muted"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <select
            value={penType}
            onChange={(e) => onPenTypeChange(e.target.value as PenType)}
            className="rounded-full border border-border bg-background-alt px-3 py-1.5 text-xs font-medium text-foreground"
          >
            {PEN_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="flex items-center gap-1 rounded-full border border-border bg-background-alt p-1">
          {ERASER_SIZES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onEraserRadiusChange(s.value)}
              title={s.label}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                eraserRadius === s.value ? "bg-card text-accent-dark shadow-sm" : "text-muted"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
