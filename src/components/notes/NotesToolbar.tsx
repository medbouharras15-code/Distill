"use client";

import type { ComponentType, ReactNode, RefObject } from "react";
import type { EraserMode, EraserTarget, HighlighterMode, PenType, ShapeType } from "@/lib/notes/types";
import type { NotesTool } from "./NotesCanvas";
import { useEffect, useRef, useState } from "react";
import { AiOrb } from "@/components/Brand";
import { TOOL_ICON_ASSETS, type ToolIconKey } from "@/lib/notes/toolIconAssets";
import { ToolIconAsset } from "./ToolIconAsset";
import {
  BallpointPenIcon,
  CircleShapeIcon,
  DragHandleIcon,
  EraserIcon,
  FitScreenIcon,
  HighlighterIcon,
  LassoIcon,
  LineShapeIcon,
  NoteIcon,
  PanIcon,
  PdfFileIcon,
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
    <div className="flex items-center gap-1.5">
      {colors.map((c) => {
        const active = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            aria-label={c.label}
            title={c.label}
            className={`h-6 w-6 shrink-0 rounded-full border-2 transition-all duration-200 active:scale-90 ${
              active
                ? "scale-110 border-accent shadow-[0_2px_10px_-3px_color-mix(in_srgb,var(--accent)_65%,transparent)]"
                : "border-border/60 hover:scale-105 hover:border-muted-foreground/40"
            }`}
            style={{ backgroundColor: c.value, ...EASE_SIGNATURE_STYLE }}
          />
        );
      })}

      <span className="relative h-6 w-6 shrink-0" title="Palette complète">
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
      className="h-7 w-7 shrink-0 rounded-full border-2 border-border/70 shadow-[var(--shadow-sm)]"
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
    <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border/70 bg-background-alt/70 p-1">
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
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-all duration-200 active:scale-90 ${
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
    // Étiquette texte retirée (gardée en title/aria-label, visible au survol
    // et pour les lecteurs d'écran) : la barre compacte n'a plus la place
    // pour un nom sous chaque icône — la cible tactile reste ~40px (h-10
    // w-10), volontairement pas réduite en dessous pour rester confortable
    // au doigt/stylet sur iPad.
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={title ?? (disabled ? `${label} — bientôt disponible` : label)}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:active:scale-100 ${
        disabled
          ? "text-muted/50"
          : active
            ? SELECTED_TOOL_GLOW
            : "text-foreground/70 hover:bg-background-alt hover:text-foreground"
      }`}
      style={EASE_SIGNATURE_STYLE}
    >
      <ToolIconAsset asset={TOOL_ICON_ASSETS[iconKey]} fallback={fallback} alt={label} />
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
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-foreground/70 transition-all duration-200 hover:bg-background-alt hover:text-foreground active:scale-90 disabled:cursor-not-allowed disabled:text-muted/40 disabled:hover:bg-transparent disabled:active:scale-100"
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
  onSelectLasso: () => void;
  onPenDoubleClick: () => void;
  /** Vrai si le presse-papiers interne du Lasso contient quelque chose —
   * pilote l'affichage du bouton "Coller" (voir NotesPageClient). */
  hasClipboard: boolean;
  onPaste: () => void;
  onImportPhotos: (files: FileList) => void;
  /** Import PDF (voir NotesPageClient.handleImportPdf) — un seul fichier à
   * la fois, contrairement à onImportPhotos (qui accepte une sélection
   * multiple), puisqu'un import PDF crée déjà plusieurs pages à lui seul. */
  onImportPdf: (file: File) => void;

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

  /** Conteneur `relative` dans lequel cette toolbar flotte et se déplace
   * (voir NotesPageClient.tsx, `editorAreaRef`) — sert à borner le drag
   * (voir la poignée ci-dessous) pour que la toolbar reste toujours
   * entièrement visible, jamais partiellement hors de cette zone. */
  boundsRef: RefObject<HTMLDivElement | null>;
}

/** Position persistée de la toolbar flottante — en fractions [0,1] de
 * l'espace de déplacement RÉELLEMENT disponible (taille du conteneur moins
 * taille de la toolbar elle-même), jamais en pixels bruts ni en fraction
 * simple de la taille du conteneur : ainsi, `x = xFrac * (containerWidth -
 * toolbarWidth)` reste TOUJOURS dans `[0, containerWidth - toolbarWidth]`
 * par construction, quels que soient les changements de taille du
 * conteneur (rotation d'écran) ou de la toolbar elle-même (barre d'options
 * qui apparaît/disparaît) — la toolbar reste garantie entièrement visible
 * sans recalcul de clamp complexe à chaque cas. */
interface ToolbarPos {
  xFrac: number;
  yFrac: number;
}

const TOOLBAR_POS_STORAGE_KEY = "distill-notes-toolbar-pos";
/** Position par défaut avant toute lecture de localStorage (ou en cas
 * d'échec) — haut de l'écran, légèrement décalée du bord gauche. */
const DEFAULT_TOOLBAR_POS: ToolbarPos = { xFrac: 0.02, yFrac: 0.02 };
/** Distance (fraction de l'espace de déplacement) en dessous de laquelle
 * un relâchement de drag aligne la toolbar sur le bord le plus proche —
 * léger effet d'aimantation, purement cosmétique. */
const SNAP_THRESHOLD_FRAC = 0.04;

function clampFrac(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function readStoredToolbarPos(): ToolbarPos {
  try {
    const raw = localStorage.getItem(TOOLBAR_POS_STORAGE_KEY);
    if (!raw) return DEFAULT_TOOLBAR_POS;
    const parsed = JSON.parse(raw) as Partial<ToolbarPos>;
    if (typeof parsed.xFrac !== "number" || typeof parsed.yFrac !== "number") return DEFAULT_TOOLBAR_POS;
    return { xFrac: clampFrac(parsed.xFrac), yFrac: clampFrac(parsed.yFrac) };
  } catch {
    return DEFAULT_TOOLBAR_POS;
  }
}

export function NotesToolbar({
  boundsRef,
  tool,
  onSelectPen,
  onSelectHighlighter,
  onSelectEraser,
  onSelectShapes,
  onSelectPhoto,
  onSelectPan,
  onSelectText,
  onSelectLasso,
  onPenDoubleClick,
  onImportPhotos,
  onImportPdf,
  hasClipboard,
  onPaste,
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
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const [moreHighlighterOptionsOpen, setMoreHighlighterOptionsOpen] = useState(false);

  const selectPenType = (type: PenType) => {
    onSelectPen();
    onPenTypeChange(type);
  };

  // Position de la toolbar flottante — voir ToolbarPos ci-dessus. Lue une
  // seule fois au montage (jamais recalculée depuis localStorage ensuite),
  // écrite au relâchement d'un drag.
  const [pos, setPos] = useState<ToolbarPos>(readStoredToolbarPos);
  const rootRef = useRef<HTMLDivElement | null>(null);
  /** Donnée de geste en cours — en ref (jamais en state) : lue/écrite à
   * chaque pointermove, un state React serait à la fois inutile (rien
   * n'affiche cette donnée brute) et plus lent (re-rendu à chaque frame). */
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startLeft: number;
    startTop: number;
    maxX: number;
    maxY: number;
  } | null>(null);

  /** Tailles mesurées (conteneur + toolbar elle-même) — en state, jamais lues
   * depuis les refs pendant le rendu (interdit par les règles des Hooks :
   * un ref n'est garanti à jour qu'après montage/effet, jamais pendant le
   * rendu lui-même). Mises à jour au montage puis à chaque changement de
   * taille du conteneur (rotation/redimensionnement) OU de la toolbar
   * elle-même (barre d'options qui apparaît/disparaît selon l'outil). */
  const [measured, setMeasured] = useState({ containerW: 0, containerH: 0, toolbarW: 0, toolbarH: 0 });
  useEffect(() => {
    const container = boundsRef.current;
    const el = rootRef.current;
    if (!container || !el) return;
    const update = () => {
      const containerRect = container.getBoundingClientRect();
      const toolbarRect = el.getBoundingClientRect();
      setMeasured({
        containerW: containerRect.width,
        containerH: containerRect.height,
        toolbarW: toolbarRect.width,
        toolbarH: toolbarRect.height,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(el);
    return () => observer.disconnect();
  }, [boundsRef]);

  const maxX = Math.max(0, measured.containerW - measured.toolbarW);
  const maxY = Math.max(0, measured.containerH - measured.toolbarH);
  const left = pos.xFrac * maxX;
  const top = pos.yFrac * maxY;

  function persistPos(next: ToolbarPos) {
    try {
      localStorage.setItem(TOOLBAR_POS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Mode privé, quota dépassé... : la position reste valable pour
      // cette session, simplement pas mémorisée pour la prochaine.
    }
  }

  /** Aimante légèrement la position au bord le plus proche si elle en est
   * déjà proche au relâchement — purement cosmétique, jamais appliqué
   * pendant le drag lui-même (seulement au pointerup). */
  function applySnap(p: ToolbarPos): ToolbarPos {
    const snap = (v: number) => (v < SNAP_THRESHOLD_FRAC ? 0 : v > 1 - SNAP_THRESHOLD_FRAC ? 1 : v);
    return { xFrac: snap(p.xFrac), yFrac: snap(p.yFrac) };
  }

  function handleHandlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    const container = boundsRef.current;
    const el = rootRef.current;
    if (!container || !el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const containerR = container.getBoundingClientRect();
    const elR = el.getBoundingClientRect();
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startLeft: elR.left - containerR.left,
      startTop: elR.top - containerR.top,
      maxX: Math.max(0, containerR.width - elR.width),
      maxY: Math.max(0, containerR.height - elR.height),
    };
  }

  function handleHandlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    const nextLeft = Math.max(0, Math.min(drag.maxX, drag.startLeft + dx));
    const nextTop = Math.max(0, Math.min(drag.maxY, drag.startTop + dy));
    setPos({
      xFrac: drag.maxX > 0 ? nextLeft / drag.maxX : 0,
      yFrac: drag.maxY > 0 ? nextTop / drag.maxY : 0,
    });
  }

  function handleHandlePointerUp() {
    if (!dragRef.current) return;
    dragRef.current = null;
    setPos((prev) => {
      const snapped = applySnap(prev);
      persistPos(snapped);
      return snapped;
    });
  }

  return (
    // pointer-events-none sur la colonne : avec deux barres empilées (+ leur
    // écart), le rectangle englobant du conteneur dépasse largement les
    // barres visibles — sans ça, cette zone "vide" mais cliquable avalait le
    // pincer-zoomer et le glisser du canvas juste en dessous/entre les
    // barres. Chaque barre repasse en pointer-events-auto individuellement.
    // Positionnée en absolute (voir NotesPageClient.tsx, `boundsRef`) :
    // `left`/`top` sont recalculés à chaque rendu depuis `pos` (fractions
    // persistées) et les tailles réelles mesurées — jamais mis en cache,
    // donc toujours cohérents après une rotation d'écran ou un changement
    // de taille de la toolbar elle-même.
    <div
      ref={rootRef}
      className="pointer-events-none absolute flex w-fit max-w-[calc(100%-8px)] flex-col items-center gap-2"
      style={{ left, top }}
    >
      {/* Barre flottante principale : outils de dessin, avec un léger halo
          décoratif jade et un fond vitré (backdrop-blur) — cohérent avec la
          signature "premium" du reste du site (AiPanel, Dashboard) sans
          reprendre .ai-gradient, réservé à la signature IA elle-même. */}
      <div className="pointer-events-auto relative w-fit max-w-full">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-8 -top-10 h-36 w-36 rounded-full opacity-25 blur-2xl"
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 38%, transparent) 0%, transparent 72%)" }}
        />
        <div className="relative flex flex-nowrap items-center gap-1.5 overflow-x-auto rounded-2xl border border-border/60 bg-card/95 px-2 py-1.5 shadow-[var(--shadow-lg)] backdrop-blur-sm">
          {/* Poignée de déplacement — seul élément qui déclenche le drag de
              toute la toolbar (barre principale + barre d'options en
              dessous, ancrées ensemble) ; `touch-action: none` empêche le
              geste de défiler/zoomer la page pendant qu'on glisse la
              poignée sur iPad. */}
          <button
            type="button"
            aria-label="Déplacer la barre d'outils"
            title="Déplacer la barre d'outils"
            onPointerDown={handleHandlePointerDown}
            onPointerMove={handleHandlePointerMove}
            onPointerUp={handleHandlePointerUp}
            onPointerCancel={handleHandlePointerUp}
            className="grid h-10 w-6 shrink-0 cursor-grab place-items-center rounded-xl text-muted transition-colors hover:bg-background-alt hover:text-foreground active:cursor-grabbing"
            style={{ touchAction: "none" }}
          >
            <DragHandleIcon className="h-4 w-4" />
          </button>

          <div className="h-8 w-px shrink-0 bg-border/70" />

          <button
            type="button"
            onClick={onToggleAi}
            aria-pressed={aiOpen}
            title="IA Distill — résumé & flashcards"
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${
              aiOpen
                ? "ai-gradient text-white shadow-[0_4px_14px_-6px_var(--ai-glow)]"
                : "border border-border/70 text-foreground/80 hover:border-accent/40 hover:bg-background-alt hover:text-foreground"
            }`}
          >
            <AiOrb size={20} active={aiOpen} /> IA
          </button>

          <div className="h-8 w-px shrink-0 bg-border/70" />

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

          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportPdf(file);
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
            <ToolButton
              active={tool === "lasso"}
              label="Lasso"
              iconKey="lasso"
              fallback={<LassoIcon className="h-5 w-5" />}
              onClick={onSelectLasso}
            />
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
              active={false}
              label="PDF"
              iconKey="pdf"
              fallback={<PdfFileIcon className="h-5 w-5" />}
              onClick={() => pdfInputRef.current?.click()}
              title="Importer un PDF (une page Distill par page PDF)"
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

          <div className="h-8 w-px shrink-0 bg-border/70" />

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

          <div className="h-8 w-px shrink-0 bg-border/70" />

          <button
            type="button"
            onClick={onFitToScreen}
            aria-label="Ajuster à l'écran (zoom 100%)"
            title="Ajuster à l'écran (zoom 100%)"
            className="flex h-10 shrink-0 items-center gap-1 rounded-full border border-accent/50 bg-accent-light px-2.5 text-[11px] font-semibold text-accent-dark transition-all duration-200 hover:brightness-95 active:scale-95"
          >
            <FitScreenIcon className="h-4 w-4" />
            100%
          </button>
        </div>
      </div>

      {/* Seconde barre flottante : réglages de l'outil actif (épaisseur,
          couleurs, indicateur de couleur sélectionnée, "Plus d'options"). */}
      {tool === "pen" && (
        <div className="pointer-events-auto flex max-w-full flex-nowrap animate-fade items-center gap-2 overflow-x-auto rounded-full border border-border/60 bg-card/95 px-3 py-1.5 shadow-[var(--shadow-lg)] backdrop-blur-sm">
          <SizeDotPicker sizes={PEN_SIZES} value={penSize} onChange={onPenSizeChange} />
          <div className="h-8 w-px shrink-0 bg-border/70" />
          <ColorRow colors={PEN_COLORS} value={penColor} onChange={onPenColorChange} />
          <SelectedColorIndicator color={penColor} />
        </div>
      )}

      {tool === "highlighter" && (
        <div className="pointer-events-auto flex max-w-full flex-col items-stretch gap-2 rounded-2xl border border-border/60 bg-card/95 px-3 py-1.5 shadow-[var(--shadow-lg)] backdrop-blur-sm">
          <div className="flex flex-nowrap animate-fade items-center gap-2 overflow-x-auto">
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
        <div className="pointer-events-auto flex max-w-full flex-nowrap animate-fade items-center gap-2 overflow-x-auto rounded-full border border-border/60 bg-card/95 px-3 py-1.5 shadow-[var(--shadow-lg)] backdrop-blur-sm">
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
        <div className="pointer-events-auto flex max-w-full flex-nowrap animate-fade items-center gap-2 overflow-x-auto rounded-full border border-border/60 bg-card/95 px-3 py-1.5 shadow-[var(--shadow-lg)] backdrop-blur-sm">
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
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-all duration-200 active:scale-90 ${
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
          className="pointer-events-auto flex shrink-0 animate-fade items-center gap-2 rounded-full border border-border/60 bg-card/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-[var(--shadow-lg)] backdrop-blur-sm transition-all duration-200 hover:border-accent/40 active:scale-95"
        >
          <PhotoIcon className="h-4 w-4" />
          Ajouter une photo
        </button>
      )}

      {/* Coller n'a pas besoin d'une sélection active (voir
          NotesCanvas/SelectionContextMenu pour Copier/Couper/Dupliquer/
          Supprimer, qui eux exigent une sélection) — seulement que le
          presse-papiers contienne quelque chose, potentiellement copié
          depuis une autre page du même carnet. */}
      {tool === "lasso" && hasClipboard && (
        <button
          type="button"
          onClick={onPaste}
          className="pointer-events-auto flex shrink-0 animate-fade items-center gap-2 rounded-full border border-border/60 bg-card/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-[var(--shadow-lg)] backdrop-blur-sm transition-all duration-200 hover:border-accent/40 active:scale-95"
        >
          Coller
        </button>
      )}
    </div>
  );
}
