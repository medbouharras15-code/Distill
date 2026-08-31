"use client";

import type { ComponentType, ReactNode } from "react";
import type { EraserMode, EraserTarget, HighlighterMode, PenType, ShapeType } from "@/lib/notes/types";
import type { NotesTool } from "./NotesCanvas";
import { useRef, useState } from "react";
import { AiOrb } from "@/components/Brand";
import { TOOL_ICON_ASSETS, type ToolIconKey } from "@/lib/notes/toolIconAssets";
import { ToolIconAsset } from "./ToolIconAsset";
import {
  BallpointPenIcon,
  CircleShapeIcon,
  EraserIcon,
  FitScreenIcon,
  HighlighterIcon,
  LassoIcon,
  LineShapeIcon,
  NoteIcon,
  PanIcon,
  PencilIcon,
  PenIcon,
  PhotoIcon,
  RectangleShapeIcon,
  RedoIcon,
  RulerIcon,
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
  { label: "Violet", value: "#a08bd6" },
  { label: "Orange", value: "#e0a35c" },
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

/** Crans d'intensité du Surligneur — mêmes valeurs d'opacité que
 * `HIGHLIGHTER_ALPHA` (canvasUtils.ts) pour le cran "Moyen", pour que le
 * réglage par défaut ne change rien visuellement tant qu'on n'y touche pas. */
export const HIGHLIGHTER_OPACITIES: { label: string; value: number }[] = [
  { label: "Clair", value: 0.24 },
  { label: "Moyen", value: 0.38 },
  { label: "Foncé", value: 0.55 },
];

const HIGHLIGHTER_MODES: { value: HighlighterMode; label: string }[] = [
  { value: "freehand", label: "Libre" },
  { value: "straight", label: "Droit" },
];

/** Les trois variantes de stylo, promues en boutons visibles de la barre
 * principale (auparavant un menu déroulant caché) — chacune sélectionne
 * l'outil "pen" et fixe `penType`, la couleur/taille restant partagées. */
const PEN_TYPE_TOOLS: {
  value: PenType;
  label: string;
  iconKey: ToolIconKey;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  { value: "fineliner", label: "Stylo", iconKey: "pen-fineliner", Icon: PenIcon },
  { value: "ballpoint", label: "Stylo bille", iconKey: "pen-ballpoint", Icon: BallpointPenIcon },
  { value: "crayon", label: "Crayon", iconKey: "pen-crayon", Icon: PencilIcon },
];

/** La Gomme expose un seul sélecteur à 3 choix dans la barre — pas les deux
 * réglages `EraserMode`/`EraserTarget` séparément (qui restent le modèle de
 * données interne, utilisé tel quel par NotesCanvas) : chaque bouton fixe
 * les deux à la fois, pour rester "simple" comme demandé plutôt que
 * d'exposer les 4 combinaisons théoriquement possibles. */
const ERASER_UI_MODES: { label: string; mode: EraserMode; target: EraserTarget }[] = [
  { label: "Précise", mode: "partial", target: "all" },
  { label: "Trait entier", mode: "whole", target: "all" },
  { label: "Surlignage", mode: "whole", target: "highlighter" },
];

const SHAPE_TYPES: { value: ShapeType; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { value: "rectangle", label: "Rectangle", Icon: RectangleShapeIcon },
  { value: "circle", label: "Cercle", Icon: CircleShapeIcon },
  { value: "triangle", label: "Triangle", Icon: TriangleShapeIcon },
  { value: "line", label: "Ligne", Icon: LineShapeIcon },
];

const RAINBOW_GRADIENT =
  "conic-gradient(from 90deg, #a83e35, #d4a13a, #2f6b4f, #3d6fa8, #7451a8, #a83e35)";

/** Courbe signature de l'app pour les micro-interactions de cette barre
 * (survol/sélection d'une pastille, d'une taille...) — passée en style
 * inline comme ailleurs dans le code (voir NotesPageClient.tsx, ouverture du
 * panneau IA) car --ease-signature n'est pas exposée comme utilitaire
 * Tailwind. */
const EASE_SIGNATURE_STYLE = { transitionTimingFunction: "var(--ease-signature)" };

/** Glow menthe (accent) d'un outil sélectionné dans la barre principale : un
 * contour net + une diffusion large autour d'un fond à peine teinté — un
 * halo, pas un aplat plein — pour coller à la carte à contour lumineux de la
 * référence plutôt qu'à un rond de couleur pleine. Construit sur les tokens
 * --accent existants plutôt qu'une couleur codée en dur, pour rester correct
 * en mode clair comme en mode sombre. */
const SELECTED_TOOL_GLOW =
  "bg-accent/12 text-accent-dark ring-2 ring-accent shadow-[0_0_22px_-4px_color-mix(in_srgb,var(--accent)_85%,transparent)]";

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
    <div className="flex items-center gap-2">
      {colors.map((c) => {
        const active = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            aria-label={c.label}
            title={c.label}
            className={`h-7 w-7 shrink-0 rounded-full border-2 transition-all duration-200 active:scale-90 ${
              active
                ? "scale-110 border-accent shadow-[0_2px_10px_-3px_color-mix(in_srgb,var(--accent)_65%,transparent)]"
                : "border-border/60 hover:scale-105 hover:border-muted-foreground/40"
            }`}
            style={{ backgroundColor: c.value, ...EASE_SIGNATURE_STYLE }}
          />
        );
      })}

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
          className={`pointer-events-none absolute inset-0 rounded-full border-2 transition-all duration-200 ${
            isCustom
              ? "scale-110 border-accent shadow-[0_2px_10px_-3px_color-mix(in_srgb,var(--accent)_65%,transparent)]"
              : "border-border/60"
          }`}
          style={{ background: isCustom ? value : RAINBOW_GRADIENT, ...EASE_SIGNATURE_STYLE }}
        />
      </span>
    </div>
  );
}

/** Aperçu non-interactif de la couleur actuellement active — distinct de la
 * pastille sélectionnée dans ColorRow, pour rester lisible même quand la
 * couleur en cours est une couleur personnalisée qui ne fait pas partie de
 * la palette rapide. */
function SelectedColorIndicator({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      title="Couleur actuelle"
      className="h-8 w-8 shrink-0 rounded-full border-2 border-border/70 shadow-[var(--shadow-sm)]"
      style={{ backgroundColor: color }}
    />
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
    <div className="flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-background-alt/70 p-1">
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
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all duration-200 active:scale-90 ${
              active ? "scale-105 bg-card shadow-[var(--shadow-sm)] ring-1 ring-accent/60" : "hover:bg-card/60"
            }`}
            style={EASE_SIGNATURE_STYLE}
          >
            <span
              className={`rounded-full transition-colors duration-200 ${active ? "bg-accent-dark" : "bg-foreground/60"}`}
              style={{ width: dot, height: dot }}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Bouton de la barre principale : icône (asset réaliste si configuré, sinon
 * repli SVG plat) + nom sous l'icône + glow menthe quand sélectionné. Les
 * outils pas encore branchés au moteur de dessin (Règle, Lasso, Note) sont
 * rendus désactivés plutôt que masqués, pour montrer où ils arriveront. */
function ToolButton({
  active,
  disabled,
  label,
  iconKey,
  fallback,
  onClick,
  onDoubleClick,
  title,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  iconKey: ToolIconKey;
  fallback: ReactNode;
  onClick?: () => void;
  onDoubleClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      disabled={disabled}
      aria-pressed={active}
      title={title ?? (disabled ? `${label} — bientôt disponible` : label)}
      className="flex w-14 shrink-0 flex-col items-center gap-1 rounded-2xl py-1 transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:active:scale-100"
    >
      <span
        className={`grid h-11 w-11 place-items-center rounded-2xl transition-all duration-200 ${
          disabled
            ? "text-muted/50"
            : active
              ? SELECTED_TOOL_GLOW
              : "text-foreground/70 hover:bg-background-alt hover:text-foreground"
        }`}
        style={EASE_SIGNATURE_STYLE}
      >
        <ToolIconAsset asset={TOOL_ICON_ASSETS[iconKey]} fallback={fallback} alt={label} />
      </span>
      <span
        className={`text-[10px] font-medium leading-none transition-colors duration-200 ${
          disabled ? "text-muted/50" : active ? "text-accent-dark" : "text-muted"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

/** Bouton compact sans étiquette pour Annuler/Rétablir — comme dans la
 * référence, ces deux actions restent de simples icônes, sans nom dessous
 * ni glow de sélection (ce ne sont pas des outils qu'on "sélectionne"). */
function ActionIconButton({
  disabled,
  iconKey,
  fallback,
  onClick,
  title,
}: {
  disabled?: boolean;
  iconKey: ToolIconKey;
  fallback: ReactNode;
  onClick?: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-foreground/70 transition-all duration-200 hover:bg-background-alt hover:text-foreground active:scale-90 disabled:cursor-not-allowed disabled:text-muted/40 disabled:hover:bg-transparent disabled:active:scale-100"
    >
      <ToolIconAsset asset={TOOL_ICON_ASSETS[iconKey]} fallback={fallback} alt={title} />
    </button>
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
  highlighterMode: HighlighterMode;
  onHighlighterModeChange: (mode: HighlighterMode) => void;
  highlighterOpacity: number;
  onHighlighterOpacityChange: (opacity: number) => void;

  eraserRadius: number;
  onEraserRadiusChange: (radius: number) => void;
  eraserMode: EraserMode;
  onEraserModeChange: (mode: EraserMode) => void;
  eraserTarget: EraserTarget;
  onEraserTargetChange: (target: EraserTarget) => void;

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

  /** Instrument auxiliaire, indépendant de `tool` — voir NotesPageClient. */
  rulerActive: boolean;
  onToggleRuler: () => void;
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
  highlighterMode,
  onHighlighterModeChange,
  highlighterOpacity,
  onHighlighterOpacityChange,
  eraserRadius,
  onEraserRadiusChange,
  eraserMode,
  onEraserModeChange,
  eraserTarget,
  onEraserTargetChange,
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
  rulerActive,
  onToggleRuler,
}: NotesToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [moreHighlighterOptionsOpen, setMoreHighlighterOptionsOpen] = useState(false);

  const selectPenType = (type: PenType) => {
    onSelectPen();
    onPenTypeChange(type);
  };

  return (
    // pointer-events-none sur la colonne : avec deux barres empilées (+ leur
    // écart), le rectangle englobant du conteneur dépasse largement les
    // barres visibles — sans ça, cette zone "vide" mais cliquable avalait le
    // pincer-zoomer et le glisser du canvas juste en dessous/entre les
    // barres. Chaque barre repasse en pointer-events-auto individuellement.
    <div className="pointer-events-none flex flex-col items-center gap-2.5">
      {/* Barre flottante principale : outils de dessin, réellement positionnée
          au-dessus du canvas (voir NotesPageClient.tsx), avec un léger halo
          décoratif jade et un fond vitré (backdrop-blur) — cohérent avec la
          signature "premium" du reste du site (AiPanel, Dashboard) sans
          reprendre .ai-gradient, réservé à la signature IA elle-même. */}
      <div className="pointer-events-auto relative w-full">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-8 -top-10 h-36 w-36 rounded-full opacity-25 blur-2xl"
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 38%, transparent) 0%, transparent 72%)" }}
        />
        <div className="relative flex flex-nowrap items-center gap-2 overflow-x-auto rounded-2xl border border-border/60 bg-card/95 px-3 py-2.5 shadow-[var(--shadow-lg)] backdrop-blur-sm">
          <button
            type="button"
            onClick={onToggleAi}
            aria-pressed={aiOpen}
            title="IA Distill — résumé & flashcards"
            className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${
              aiOpen
                ? "ai-gradient text-white shadow-[0_4px_14px_-6px_var(--ai-glow)]"
                : "border border-border/70 text-foreground/80 hover:border-accent/40 hover:bg-background-alt hover:text-foreground"
            }`}
          >
            <AiOrb size={20} active={aiOpen} /> IA
          </button>

          <div className="h-12 w-px shrink-0 bg-border/70" />

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

          <div className="flex shrink-0 items-start gap-0.5">
            {PEN_TYPE_TOOLS.map(({ value, label, iconKey, Icon }) => (
              <ToolButton
                key={value}
                active={tool === "pen" && penType === value}
                label={label}
                iconKey={iconKey}
                fallback={<Icon className="h-5 w-5" />}
                onClick={() => selectPenType(value)}
                onDoubleClick={onPenDoubleClick}
                title={`${label} (double-clic : gomme rapide)`}
              />
            ))}
            <ToolButton
              active={tool === "highlighter"}
              label="Surligneur"
              iconKey="highlighter"
              fallback={<HighlighterIcon className="h-5 w-5" />}
              onClick={onSelectHighlighter}
            />
            <ToolButton
              active={tool === "eraser"}
              label="Gomme"
              iconKey="eraser"
              fallback={<EraserIcon className="h-5 w-5" />}
              onClick={onSelectEraser}
            />
            <ToolButton
              active={rulerActive}
              label="Règle"
              iconKey="ruler"
              fallback={<RulerIcon className="h-5 w-5" />}
              onClick={onToggleRuler}
              title="Règle (reste active avec l'outil de dessin choisi)"
            />
            <ToolButton disabled active={false} label="Lasso" iconKey="lasso" fallback={<LassoIcon className="h-5 w-5" />} />
            <ToolButton
              active={tool === "text"}
              label="Texte"
              iconKey="text"
              fallback={<TextToolIcon className="h-5 w-5" />}
              onClick={onSelectText}
            />
            <ToolButton disabled active={false} label="Note" iconKey="note" fallback={<NoteIcon className="h-5 w-5" />} />
            <ToolButton
              active={tool === "photo"}
              label="Image"
              iconKey="photo"
              fallback={<PhotoIcon className="h-5 w-5" />}
              onClick={onSelectPhoto}
            />
            <ToolButton
              active={tool === "shapes"}
              label="Formes"
              iconKey="shapes"
              fallback={<ShapesIcon className="h-5 w-5" />}
              onClick={onSelectShapes}
            />
            <ToolButton
              active={tool === "pan"}
              label="Déplacer"
              iconKey="pan"
              fallback={<PanIcon className="h-5 w-5" />}
              onClick={onSelectPan}
            />
          </div>

          <div className="h-12 w-px shrink-0 bg-border/70" />

          <div className="flex shrink-0 items-center gap-0.5">
            <ActionIconButton
              disabled={!canUndo}
              iconKey="undo"
              fallback={<UndoIcon className="h-5 w-5" />}
              onClick={onUndo}
              title="Annuler"
            />
            <ActionIconButton
              disabled={!canRedo}
              iconKey="redo"
              fallback={<RedoIcon className="h-5 w-5" />}
              onClick={onRedo}
              title="Rétablir"
            />
          </div>

          <div className="h-12 w-px shrink-0 bg-border/70" />

          <button
            type="button"
            onClick={onFitToScreen}
            aria-label="Ajuster à l'écran (zoom 100%)"
            title="Ajuster à l'écran (zoom 100%)"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-accent/50 bg-accent-light px-3 py-1.5 text-xs font-semibold text-accent-dark transition-all duration-200 hover:brightness-95 active:scale-95"
          >
            <FitScreenIcon className="h-4 w-4" />
            100%
          </button>
        </div>
      </div>

      {/* Seconde barre flottante : réglages de l'outil actif (épaisseur,
          couleurs, indicateur de couleur sélectionnée, "Plus d'options"). */}
      {tool === "pen" && (
        <div className="pointer-events-auto flex max-w-full flex-nowrap animate-fade items-center gap-3 overflow-x-auto rounded-full border border-border/60 bg-card/95 px-4 py-2.5 shadow-[var(--shadow-lg)] backdrop-blur-sm">
          <SizeDotPicker sizes={PEN_SIZES} value={penSize} onChange={onPenSizeChange} />
          <div className="h-8 w-px shrink-0 bg-border/70" />
          <ColorRow colors={PEN_COLORS} value={penColor} onChange={onPenColorChange} />
          <SelectedColorIndicator color={penColor} />
        </div>
      )}

      {tool === "highlighter" && (
        <div className="pointer-events-auto flex max-w-full flex-col items-stretch gap-2 rounded-2xl border border-border/60 bg-card/95 px-4 py-2.5 shadow-[var(--shadow-lg)] backdrop-blur-sm">
          <div className="flex flex-nowrap animate-fade items-center gap-3 overflow-x-auto">
            <SizeDotPicker sizes={HIGHLIGHTER_SIZES} value={highlighterSize} onChange={onHighlighterSizeChange} />
            <div className="h-8 w-px shrink-0 bg-border/70" />
            <ColorRow colors={HIGHLIGHTER_COLORS} value={highlighterColor} onChange={onHighlighterColorChange} />
            <SelectedColorIndicator color={highlighterColor} />
            <div className="h-8 w-px shrink-0 bg-border/70" />
            <button
              type="button"
              onClick={() => setMoreHighlighterOptionsOpen((v) => !v)}
              aria-expanded={moreHighlighterOptionsOpen}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${
                moreHighlighterOptionsOpen
                  ? "bg-accent-light text-accent-dark"
                  : "border border-border/70 text-foreground/80 hover:border-accent/40 hover:bg-background-alt hover:text-foreground"
              }`}
            >
              Plus d&apos;options
            </button>
          </div>
          {moreHighlighterOptionsOpen && (
            <div className="flex flex-col flex-nowrap animate-fade items-stretch gap-2 overflow-x-auto">
              <div className="flex shrink-0 items-center gap-1 self-start rounded-full border border-border/70 bg-background-alt/70 p-1">
                {HIGHLIGHTER_MODES.map(({ value, label }) => {
                  const active = highlighterMode === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onHighlighterModeChange(value)}
                      aria-pressed={active}
                      title={label}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95 ${
                        active
                          ? "bg-card text-accent-dark shadow-[var(--shadow-sm)] ring-1 ring-accent/60"
                          : "text-muted hover:text-foreground"
                      }`}
                      style={EASE_SIGNATURE_STYLE}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="flex shrink-0 items-center gap-1 self-start rounded-full border border-border/70 bg-background-alt/70 p-1">
                {HIGHLIGHTER_OPACITIES.map(({ value, label }) => {
                  const active = highlighterOpacity === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onHighlighterOpacityChange(value)}
                      aria-pressed={active}
                      title={label}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95 ${
                        active
                          ? "bg-card text-accent-dark shadow-[var(--shadow-sm)] ring-1 ring-accent/60"
                          : "text-muted hover:text-foreground"
                      }`}
                      style={EASE_SIGNATURE_STYLE}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tool === "eraser" && (
        <div className="pointer-events-auto flex max-w-full flex-nowrap animate-fade items-center gap-3 overflow-x-auto rounded-full border border-border/60 bg-card/95 px-4 py-2.5 shadow-[var(--shadow-lg)] backdrop-blur-sm">
          <SizeDotPicker sizes={ERASER_SIZES} value={eraserRadius} onChange={onEraserRadiusChange} />
          <div className="h-8 w-px shrink-0 bg-border/70" />
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-background-alt/70 p-1">
            {ERASER_UI_MODES.map(({ label, mode, target }) => {
              const active = eraserTarget === target && (target === "highlighter" || eraserMode === mode);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    onEraserModeChange(mode);
                    onEraserTargetChange(target);
                  }}
                  aria-pressed={active}
                  title={label}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95 ${
                    active
                      ? "bg-card text-accent-dark shadow-[var(--shadow-sm)] ring-1 ring-accent/60"
                      : "text-muted hover:text-foreground"
                  }`}
                  style={EASE_SIGNATURE_STYLE}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tool === "shapes" && (
        <div className="pointer-events-auto flex max-w-full flex-nowrap animate-fade items-center gap-3 overflow-x-auto rounded-full border border-border/60 bg-card/95 px-4 py-2.5 shadow-[var(--shadow-lg)] backdrop-blur-sm">
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-background-alt/70 p-1">
            {SHAPE_TYPES.map(({ value, label, Icon }) => {
              const active = shapeType === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onShapeTypeChange(value)}
                  aria-pressed={active}
                  title={label}
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all duration-200 active:scale-90 ${
                    active
                      ? "scale-105 bg-card text-accent-dark shadow-[var(--shadow-sm)] ring-1 ring-accent/60"
                      : "text-muted hover:bg-card/60 hover:text-foreground"
                  }`}
                  style={EASE_SIGNATURE_STYLE}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
          <div className="h-8 w-px shrink-0 bg-border/70" />
          <SizeDotPicker sizes={SHAPE_STROKE_WIDTHS} value={shapeStrokeWidth} onChange={onShapeStrokeWidthChange} />
          <ColorRow colors={SHAPE_COLORS} value={shapeColor} onChange={onShapeColorChange} />
          <SelectedColorIndicator color={shapeColor} />
        </div>
      )}

      {tool === "photo" && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="pointer-events-auto flex shrink-0 animate-fade items-center gap-2 rounded-full border border-border/60 bg-card/95 px-4 py-2.5 text-xs font-medium text-foreground shadow-[var(--shadow-lg)] backdrop-blur-sm transition-all duration-200 hover:border-accent/40 active:scale-95"
        >
          <PhotoIcon className="h-4 w-4" />
          Ajouter une photo
        </button>
      )}
    </div>
  );
}
