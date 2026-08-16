"use client";

import type { ComponentType } from "react";
import type { PenType, ShapeType } from "@/lib/notes/types";
import type { NotesTool } from "./NotesCanvas";
import { useRef } from "react";
import { AiOrb } from "@/components/Brand";
import {
  CircleShapeIcon,
  EraserIcon,
  FitScreenIcon,
  HighlighterIcon,
  LineShapeIcon,
  PanIcon,
  PenIcon,
  PhotoIcon,
  RectangleShapeIcon,
  RedoIcon,
  ShapesIcon,
  TextToolIcon,
  TriangleShapeIcon,
  UndoIcon,
} from "./icons";

export const PEN_COLORS: { label: string; value: string }[] = [
  { label: "Noir", value: "#1f1b16" },
  { label: "Vert", value: "#2f6b4f" },
  { label: "Rouge", value: "#a83e35" },
];

export const HIGHLIGHTER_COLORS: { label: string; value: string }[] = [
  { label: "Jaune", value: "#e2c14d" },
  { label: "Vert", value: "#7bb06a" },
  { label: "Rose", value: "#d98bb0" },
  { label: "Bleu", value: "#6fa0d6" },
];

export const SHAPE_COLORS: { label: string; value: string }[] = [
  { label: "Noir", value: "#1f1b16" },
  { label: "Bleu", value: "#3d6fa8" },
  { label: "Rouge", value: "#a83e35" },
];

export const PEN_SIZES = [1.5, 3, 4.5, 7, 10];
export const HIGHLIGHTER_SIZES = [8, 14, 20, 28, 36];
export const ERASER_SIZES = [6, 12, 18, 26, 36];
export const SHAPE_STROKE_WIDTHS = [1.5, 3, 4.5, 7, 10];

const PEN_TYPES: { label: string; value: PenType }[] = [
  { label: "Fine liner", value: "fineliner" },
  { label: "Stylo bille", value: "ballpoint" },
  { label: "Feutre pinceau", value: "brush" },
];

const SHAPE_TYPES: { value: ShapeType; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { value: "rectangle", label: "Rectangle", Icon: RectangleShapeIcon },
  { value: "circle", label: "Cercle", Icon: CircleShapeIcon },
  { value: "triangle", label: "Triangle", Icon: TriangleShapeIcon },
  { value: "line", label: "Ligne", Icon: LineShapeIcon },
];

const RAINBOW_GRADIENT =
  "conic-gradient(from 90deg, #a83e35, #d4a13a, #2f6b4f, #3d6fa8, #7451a8, #a83e35)";

function ColorRow({
  colors,
  value,
  onChange,
}: {
  colors: { label: string; value: string }[];
  value: string;
  onChange: (color: string) => void;
}) {
  const isCustom = !colors.some((c) => c.value === value);
  return (
    <div className="flex items-center gap-1.5">
      {colors.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          aria-label={c.label}
          title={c.label}
          className={`h-7 w-7 shrink-0 rounded-full border-2 transition ${
            value === c.value ? "border-accent scale-110" : "border-border"
          }`}
          style={{ backgroundColor: c.value }}
        />
      ))}

      <span className="relative h-7 w-7 shrink-0" title="Palette complète">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Choisir une couleur personnalisée"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 rounded-full border-2 transition ${
            isCustom ? "border-accent scale-110" : "border-border"
          }`}
          style={{ background: isCustom ? value : RAINBOW_GRADIENT }}
        />
      </span>
    </div>
  );
}

function SizeDotPicker({
  sizes,
  value,
  onChange,
}: {
  sizes: number[];
  value: number;
  onChange: (size: number) => void;
}) {
  const min = Math.min(...sizes);
  const max = Math.max(...sizes);
  const minDot = 5;
  const maxDot = 19;

  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-background-alt px-1.5 py-1.5">
      {sizes.map((s, i) => {
        const dot = max === min ? maxDot : minDot + ((s - min) / (max - min)) * (maxDot - minDot);
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            aria-pressed={active}
            aria-label={`Taille ${i + 1} sur ${sizes.length}`}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${
              active ? "bg-card shadow-sm ring-1 ring-accent" : ""
            }`}
          >
            <span
              className="rounded-full bg-foreground"
              style={{ width: dot, height: dot }}
            />
          </button>
        );
      })}
    </div>
  );
}

interface NotesToolbarProps {
  tool: NotesTool;
  onSelectPen: () => void;
  onSelectHighlighter: () => void;
  onSelectEraser: () => void;
  onSelectShapes: () => void;
  onSelectPhoto: () => void;
  onSelectPan: () => void;
  onSelectText: () => void;
  onPenDoubleClick: () => void;
  onImportPhotos: (files: FileList) => void;

  penColor: string;
  onPenColorChange: (color: string) => void;
  penSize: number;
  onPenSizeChange: (size: number) => void;
  penType: PenType;
  onPenTypeChange: (type: PenType) => void;

  highlighterColor: string;
  onHighlighterColorChange: (color: string) => void;
  highlighterSize: number;
  onHighlighterSizeChange: (size: number) => void;

  eraserRadius: number;
  onEraserRadiusChange: (radius: number) => void;

  shapeType: ShapeType;
  onShapeTypeChange: (type: ShapeType) => void;
  shapeColor: string;
  onShapeColorChange: (color: string) => void;
  shapeStrokeWidth: number;
  onShapeStrokeWidthChange: (width: number) => void;

  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onFitToScreen: () => void;

  aiOpen: boolean;
  onToggleAi: () => void;
}

export function NotesToolbar({
  tool,
  onSelectPen,
  onSelectHighlighter,
  onSelectEraser,
  onSelectShapes,
  onSelectPhoto,
  onSelectPan,
  onSelectText,
  onPenDoubleClick,
  onImportPhotos,
  penColor,
  onPenColorChange,
  penSize,
  onPenSizeChange,
  penType,
  onPenTypeChange,
  highlighterColor,
  onHighlighterColorChange,
  highlighterSize,
  onHighlighterSizeChange,
  eraserRadius,
  onEraserRadiusChange,
  shapeType,
  onShapeTypeChange,
  shapeColor,
  onShapeColorChange,
  shapeStrokeWidth,
  onShapeStrokeWidthChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onFitToScreen,
  aiOpen,
  onToggleAi,
}: NotesToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    // Forme pilule + surface légèrement translucide, volontairement distincte
    // du composant Card générique (rounded-2xl) utilisé partout ailleurs
    // (Dashboard, Mes carnets…) : cette barre est un palette d'outils flottant
    // au-dessus de la feuille, pas une carte de contenu — la faire ressembler
    // à un objet différent la rend "intégrée" au canvas plutôt que perçue
    // comme un composant générique dupliqué à cet endroit.
    <div className="flex flex-nowrap items-center gap-3 overflow-x-auto rounded-full border border-border/70 bg-card/95 px-4 py-3 shadow-[var(--shadow-lg)]">
      <button
        type="button"
        onClick={onToggleAi}
        aria-pressed={aiOpen}
        title="IA Distill — résumé & flashcards"
        className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
          aiOpen
            ? "ai-gradient text-white shadow-[0_4px_14px_-6px_var(--ai-glow)]"
            : "border border-border text-foreground hover:bg-background-alt"
        }`}
      >
        <AiOrb size={20} active={aiOpen} /> IA
      </button>

      <div className="h-8 w-px shrink-0 bg-border" />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onImportPhotos(e.target.files);
          }
          e.target.value = "";
        }}
      />
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Annuler"
          title="Annuler"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-foreground transition hover:bg-background-alt disabled:opacity-30"
        >
          <UndoIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Rétablir"
          title="Rétablir"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-foreground transition hover:bg-background-alt disabled:opacity-30"
        >
          <RedoIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="h-8 w-px shrink-0 bg-border" />

      <button
        type="button"
        onClick={onFitToScreen}
        aria-label="Ajuster à l'écran (zoom 100%)"
        title="Ajuster à l'écran (zoom 100%)"
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-accent bg-accent-light px-3 py-1.5 text-xs font-semibold text-accent-dark transition hover:brightness-95"
      >
        <FitScreenIcon className="h-4 w-4" />
        100%
      </button>

      <div className="h-8 w-px shrink-0 bg-border" />

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onSelectPen}
          onDoubleClick={onPenDoubleClick}
          aria-pressed={tool === "pen"}
          title="Stylo (double-clic : gomme rapide)"
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition ${
            tool === "pen"
              ? "border-accent bg-accent-light text-accent-dark"
              : "border-border text-foreground hover:bg-background-alt"
          }`}
        >
          <PenIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onSelectHighlighter}
          aria-pressed={tool === "highlighter"}
          title="Surligneur"
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition ${
            tool === "highlighter"
              ? "border-accent bg-accent-light text-accent-dark"
              : "border-border text-foreground hover:bg-background-alt"
          }`}
        >
          <HighlighterIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onSelectEraser}
          aria-pressed={tool === "eraser"}
          title="Gomme"
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition ${
            tool === "eraser"
              ? "border-accent bg-accent-light text-accent-dark"
              : "border-border text-foreground hover:bg-background-alt"
          }`}
        >
          <EraserIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onSelectText}
          aria-pressed={tool === "text"}
          title="Texte"
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition ${
            tool === "text"
              ? "border-accent bg-accent-light text-accent-dark"
              : "border-border text-foreground hover:bg-background-alt"
          }`}
        >
          <TextToolIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onSelectShapes}
          aria-pressed={tool === "shapes"}
          title="Formes"
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition ${
            tool === "shapes"
              ? "border-accent bg-accent-light text-accent-dark"
              : "border-border text-foreground hover:bg-background-alt"
          }`}
        >
          <ShapesIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onSelectPhoto}
          aria-pressed={tool === "photo"}
          title="Photo"
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition ${
            tool === "photo"
              ? "border-accent bg-accent-light text-accent-dark"
              : "border-border text-foreground hover:bg-background-alt"
          }`}
        >
          <PhotoIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onSelectPan}
          aria-pressed={tool === "pan"}
          title="Déplacement (naviguer sans dessiner)"
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition ${
            tool === "pan"
              ? "border-accent bg-accent-light text-accent-dark"
              : "border-border text-foreground hover:bg-background-alt"
          }`}
        >
          <PanIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="h-8 w-px shrink-0 bg-border" />

      {tool === "pen" && (
        <div className="flex flex-nowrap items-center gap-3">
          <ColorRow colors={PEN_COLORS} value={penColor} onChange={onPenColorChange} />
          <SizeDotPicker sizes={PEN_SIZES} value={penSize} onChange={onPenSizeChange} />
          <select
            value={penType}
            onChange={(e) => onPenTypeChange(e.target.value as PenType)}
            className="shrink-0 rounded-full border border-border bg-background-alt px-3 py-1.5 text-xs font-medium text-foreground"
          >
            {PEN_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {tool === "highlighter" && (
        <div className="flex flex-nowrap items-center gap-3">
          <ColorRow colors={HIGHLIGHTER_COLORS} value={highlighterColor} onChange={onHighlighterColorChange} />
          <SizeDotPicker sizes={HIGHLIGHTER_SIZES} value={highlighterSize} onChange={onHighlighterSizeChange} />
        </div>
      )}

      {tool === "eraser" && (
        <SizeDotPicker sizes={ERASER_SIZES} value={eraserRadius} onChange={onEraserRadiusChange} />
      )}

      {tool === "shapes" && (
        <div className="flex flex-nowrap items-center gap-3">
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-background-alt p-1">
            {SHAPE_TYPES.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => onShapeTypeChange(value)}
                aria-pressed={shapeType === value}
                title={label}
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition ${
                  shapeType === value ? "bg-card text-accent-dark shadow-sm" : "text-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <ColorRow colors={SHAPE_COLORS} value={shapeColor} onChange={onShapeColorChange} />
          <SizeDotPicker sizes={SHAPE_STROKE_WIDTHS} value={shapeStrokeWidth} onChange={onShapeStrokeWidthChange} />
        </div>
      )}

      {tool === "photo" && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-background-alt px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-card"
        >
          <PhotoIcon className="h-4 w-4" />
          Ajouter une photo
        </button>
      )}
    </div>
  );
}
