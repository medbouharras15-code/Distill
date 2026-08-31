"use client";

interface SelectionContextMenuProps {
  /** Position d'ancrage en % de la page (même repère que TextBoxOverlay/
   * RulerOverlay) — le menu se centre horizontalement dessus et se déploie
   * vers le haut (ou vers le bas, voir `below`, si trop près du bord). */
  leftPct: number;
  topPct: number;
  below?: boolean;
  onCopy: () => void;
  onCut: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/** Petit menu flottant Copier/Couper/Dupliquer/Supprimer pour une
 * sélection Lasso active — design minimal, cohérent avec le style pilule
 * déjà utilisé par les panneaux d'options de la toolbar (NotesToolbar.tsx). */
export function SelectionContextMenu({ leftPct, topPct, below, onCopy, onCut, onDuplicate, onDelete }: SelectionContextMenuProps) {
  return (
    <div
      className={`pointer-events-auto absolute z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border/60 bg-card/95 px-2 py-1.5 shadow-[var(--shadow-lg)] backdrop-blur-sm ${
        below ? "translate-y-2" : "-translate-y-full -mt-2"
      }`}
      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-foreground/80 transition-colors hover:bg-background-alt hover:text-foreground"
      >
        Copier
      </button>
      <button
        type="button"
        onClick={onCut}
        className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-foreground/80 transition-colors hover:bg-background-alt hover:text-foreground"
      >
        Couper
      </button>
      <button
        type="button"
        onClick={onDuplicate}
        className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-foreground/80 transition-colors hover:bg-background-alt hover:text-foreground"
      >
        Dupliquer
      </button>
      <div className="h-5 w-px shrink-0 bg-border/70" />
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
      >
        Supprimer
      </button>
    </div>
  );
}
