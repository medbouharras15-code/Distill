"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import Placeholder from "@tiptap/extension-placeholder";
import { FontSize } from "@/lib/notes/fontSizeExtension";
import { RichTextToolbar } from "./RichTextToolbar";
import { TrashIcon } from "./icons";
import type { TextBoxElement } from "@/lib/notes/types";

const TEXT_EXTENSIONS = [
  StarterKit,
  Underline,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  FontFamily,
  FontSize,
  Color,
  Link.configure({ openOnClick: false, autolink: false }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Superscript,
  Subscript,
  Placeholder.configure({ placeholder: "Écrivez quelque chose…" }),
];

const MIN_TEXTBOX_WIDTH = 80;

interface TextBoxOverlayProps {
  element: TextBoxElement;
  pageWidth: number;
  pageHeight: number;
  selected: boolean;
  /** Faux quand un autre outil que "T" est actif : le bloc reste visible
   * mais ignore les clics (qui doivent atteindre le canvas en dessous, pour
   * dessiner/gommer par-dessus une zone occupée par du texte). */
  interactive: boolean;
  autoFocus: boolean;
  onSelect: () => void;
  /** Appelé quand l'édition se termine (perte de focus), avec le HTML final
   * et si le bloc est vide — c'est le seul moment où le texte est commité
   * dans l'historique annuler/rétablir (comme un trait n'est commité qu'au
   * lever du stylet) ; un bloc vide est retiré plutôt que conservé. */
  onCommit: (html: string, isEmpty: boolean) => void;
  onMoveEnd: (x: number, y: number) => void;
  onResizeEnd: (width: number) => void;
  /** Hauteur réellement rendue, en unités logiques de page — utilisée par
   * la gomme pour détecter un contact (les blocs de texte n'ont pas de
   * hauteur stockée, elle s'ajuste au contenu). */
  onHeightChange: (height: number) => void;
  /** Supprime ce bloc entier (icône Corbeille, visible seulement quand
   * sélectionné avec l'outil Texte) — distinct d'une simple désélection. */
  onDelete: () => void;
}

export function TextBoxOverlay({
  element,
  pageWidth,
  pageHeight,
  selected,
  interactive,
  autoFocus,
  onSelect,
  onCommit,
  onMoveEnd,
  onResizeEnd,
  onHeightChange,
  onDelete,
}: TextBoxOverlayProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ startClientX: number; startClientY: number; startX: number; startY: number } | null>(
    null,
  );
  const resizeState = useRef<{ startClientX: number; startWidth: number } | null>(null);

  const editor = useEditor({
    extensions: TEXT_EXTENSIONS,
    content: element.html || "<p></p>",
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "notes-textbox-prose" },
    },
    onFocus: () => onSelect(),
    onBlur: ({ editor: ed }) => onCommit(ed.getHTML(), ed.isEmpty),
  });

  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const pxPerUnit = element.width > 0 ? entry.contentRect.width / element.width : 0;
      if (pxPerUnit > 0) onHeightChange(entry.contentRect.height / pxPerUnit);
    });
    ro.observe(node);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element.width]);

  useEffect(() => {
    if (autoFocus && editor) {
      editor.chain().focus("end").run();
    }
    // On ne veut ré-exécuter ceci que si l'instance d'éditeur change, pas à
    // chaque changement de `autoFocus` (qui redeviendrait vrai/faux au fil
    // des sélections d'autres blocs sans qu'on doive refocaliser celui-ci).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  function handleDragPointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Environnement de test synthétique sans pointeur actif — sans conséquence.
    }
    dragState.current = { startClientX: e.clientX, startClientY: e.clientY, startX: element.x, startY: element.y };
  }

  function handleDragPointerMove(e: React.PointerEvent) {
    if (!dragState.current || !boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const pxPerUnit = element.width > 0 ? rect.width / element.width : 1;
    const dx = (e.clientX - dragState.current.startClientX) / pxPerUnit;
    const dy = (e.clientY - dragState.current.startClientY) / pxPerUnit;
    // Ne doit jamais dépasser horizontalement les limites de la page (voir
    // demande) — la hauteur, elle, reste libre comme aujourd'hui.
    const clampedX = Math.min(Math.max(0, dragState.current.startX + dx), Math.max(0, pageWidth - element.width));
    boxRef.current.style.left = `${(clampedX / pageWidth) * 100}%`;
    boxRef.current.style.top = `${((dragState.current.startY + dy) / pageHeight) * 100}%`;
  }

  function handleDragPointerUp() {
    if (!dragState.current || !boxRef.current) return;
    const leftPct = parseFloat(boxRef.current.style.left) / 100;
    const topPct = parseFloat(boxRef.current.style.top) / 100;
    dragState.current = null;
    onMoveEnd(leftPct * pageWidth, topPct * pageHeight);
  }

  function handleResizePointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // idem
    }
    resizeState.current = { startClientX: e.clientX, startWidth: element.width };
  }

  function handleResizePointerMove(e: React.PointerEvent) {
    if (!resizeState.current || !boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const pxPerUnit = resizeState.current.startWidth > 0 ? rect.width / resizeState.current.startWidth : 1;
    const dx = (e.clientX - resizeState.current.startClientX) / pxPerUnit;
    // Ne doit jamais dépasser horizontalement les limites de la page : la
    // largeur maximale est bornée par l'espace restant à droite de `x`.
    const maxWidth = Math.max(MIN_TEXTBOX_WIDTH, pageWidth - element.x);
    const nextWidth = Math.min(maxWidth, Math.max(MIN_TEXTBOX_WIDTH, resizeState.current.startWidth + dx));
    boxRef.current.style.width = `${(nextWidth / pageWidth) * 100}%`;
  }

  function handleResizePointerUp() {
    if (!resizeState.current || !boxRef.current) return;
    const widthPct = parseFloat(boxRef.current.style.width) / 100;
    resizeState.current = null;
    onResizeEnd(Math.max(MIN_TEXTBOX_WIDTH, widthPct * pageWidth));
  }

  if (!editor) return null;

  const leftPct = (element.x / pageWidth) * 100;
  const topPct = (element.y / pageHeight) * 100;
  const widthPct = (element.width / pageWidth) * 100;
  // Volontairement PAS conditionné à `editor.isFocused` : plusieurs contrôles
  // de la barre riche (champ URL du lien, sélecteur de couleur natif, saisie
  // numérique de taille) font perdre le focus DOM à l'éditeur sans que
  // l'utilisateur ait quitté le bloc — la barre doit rester visible tant que
  // le bloc reste sélectionné, exactement comme dans Notion.
  const showToolbar = selected;

  return (
    <div
      ref={boxRef}
      className="absolute"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${widthPct}%`,
        pointerEvents: interactive ? "auto" : "none",
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {showToolbar && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-max max-w-[90vw]">
          <RichTextToolbar editor={editor} />
        </div>
      )}

      <div className={`relative rounded-md px-2 py-1 ${selected ? "ring-2 ring-accent ring-offset-2 ring-offset-card" : ""}`}>
        {selected && (
          <div
            className="absolute -top-3 left-1/2 z-10 h-3 w-9 -translate-x-1/2 cursor-grab touch-none rounded-t-md bg-accent/80 active:cursor-grabbing"
            onPointerDown={handleDragPointerDown}
            onPointerMove={handleDragPointerMove}
            onPointerUp={handleDragPointerUp}
            onPointerCancel={handleDragPointerUp}
            aria-label="Déplacer le bloc de texte"
            role="button"
          />
        )}

        <EditorContent editor={editor} />

        {selected && (
          <div
            className="absolute -bottom-1.5 -right-1.5 z-10 h-3.5 w-3.5 cursor-ew-resize touch-none rounded-full border border-accent bg-card"
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerUp}
            aria-label="Redimensionner le bloc de texte"
            role="button"
          />
        )}

        {/* Suppression — visible seulement sélectionné + outil Texte actif
            (interactive), jamais en survol Lasso/autre outil : icône
            Corbeille plutôt qu'un simple "×" pour que l'intention
            "supprimer le bloc" (pas juste le désélectionner) soit
            immédiate, discrète tant qu'on ne l'a pas sélectionné. */}
        {selected && interactive && (
          <button
            type="button"
            className="absolute -top-3 -right-3 z-10 grid h-6 w-6 place-items-center rounded-full border border-border bg-card text-muted shadow-sm transition hover:border-red-300 hover:text-red-600"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label="Supprimer le bloc de texte"
            title="Supprimer le bloc de texte"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
