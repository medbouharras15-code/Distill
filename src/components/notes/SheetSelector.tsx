"use client";

import { BACKGROUND_COLORS, PAPER_SIZES, SHEET_TYPES } from "@/lib/notes/sheets";
import type { PaperSize, SheetType } from "@/lib/notes/types";
import { SheetPreview } from "./SheetPreview";

interface SheetSelectorProps {
  sheetType: SheetType;
  onSheetTypeChange: (type: SheetType) => void;
  paperSize: PaperSize;
  onPaperSizeChange: (size: PaperSize) => void;
  backgroundColor: string;
  onBackgroundColorChange: (color: string) => void;
  onConfirm?: () => void;
  confirmLabel?: string;
}

export function SheetSelector({
  sheetType,
  onSheetTypeChange,
  paperSize,
  onPaperSizeChange,
  backgroundColor,
  onBackgroundColorChange,
  onConfirm,
  confirmLabel = "Commencer à écrire",
}: SheetSelectorProps) {
  const ratio = PAPER_SIZES.find((p) => p.value === paperSize)?.ratio ?? PAPER_SIZES[0].ratio;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-medium text-foreground">Choisissez votre feuille</h2>
          <p className="mt-1 text-sm text-muted">Format, couleur de fond et type de réglure.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            {PAPER_SIZES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => onPaperSizeChange(p.value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  paperSize === p.value ? "bg-accent-light text-accent-dark" : "text-muted hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1.5">
            {BACKGROUND_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => onBackgroundColorChange(c.value)}
                aria-label={c.label}
                title={c.label}
                className={`h-6 w-6 rounded-full border-2 transition ${
                  backgroundColor === c.value ? "border-accent scale-110" : "border-border"
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {SHEET_TYPES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onSheetTypeChange(s.value)}
            className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition ${
              sheetType === s.value
                ? "border-accent bg-accent-light/40 shadow-sm"
                : "border-border bg-card hover:border-accent/50"
            }`}
          >
            <SheetPreview sheetType={s.value} backgroundColor={backgroundColor} ratio={ratio} width={92} />
            <span
              className={`text-xs font-medium ${sheetType === s.value ? "text-accent-dark" : "text-foreground"}`}
            >
              {s.label}
            </span>
          </button>
        ))}
      </div>

      {onConfirm && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground transition hover:bg-accent-dark"
          >
            {confirmLabel} →
          </button>
        </div>
      )}
    </div>
  );
}
