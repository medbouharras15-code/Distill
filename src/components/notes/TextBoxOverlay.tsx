"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
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

/** Marge (pixels écran) entre le bloc et la barre riche flottante — même
 * valeur visuelle que l'ancien `mb-2`/`mt-2` Tailwind qu'elle remplace. */
const TOOLBAR_MARGIN_PX = 8;

interface TextBoxOverlayProps {
  element: TextBoxElement;
  pageWidth: number;
  pageHeight: number;
  /** Conteneur de défilement réel partagé par tout le carnet (même prop que
   * `containerRef` de NotesCanvas, simplement transmise) — sert uniquement
   * à positionner la barre riche flottante pour qu'elle reste dans la zone
   * réellement visible (pas juste dans les limites de la page logique). */
  containerRef: RefObject<HTMLDivElement | null>;
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
  containerRef,
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

  /** Vrai uniquement pendant une édition active (curseur dans le texte) —
   * distinct de `selected` (voir plus bas) : sert à masquer les poignées
   * déplacement/redimensionnement/suppression pendant la frappe, pour
   * qu'il n'y ait jamais d'ambiguïté entre placer le curseur et manipuler
   * le bloc. `selected`, lui, reste vrai plus longtemps (tant que le bloc
   * n'est pas explicitement quitté) et continue de piloter l'affichage de
   * la barre riche. */
  const [isEditing, setIsEditing] = useState(false);

  /** Position calculée de la barre riche flottante (voir l'effet plus bas)
   * — `below` bascule sous le bloc si la place au-dessus est insuffisante,
   * `offsetX` corrige un débordement horizontal. Recalculée avant peinture
   * dès que la barre est affichée, donc ces valeurs par défaut ne sont
   * jamais visibles telles quelles. */
  const toolbarWrapperRef = useRef<HTMLDivElement | null>(null);
  const [toolbarPos, setToolbarPos] = useState<{ below: boolean; offsetX: number }>({ below: false, offsetX: 0 });

  const editor = useEditor({
    extensions: TEXT_EXTENSIONS,
    content: element.html || "<p></p>",
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "notes-textbox-prose" },
    },
    onFocus: () => {
      onSelect();
      setIsEditing(true);
    },
    onBlur: ({ editor: ed }) => {
      onCommit(ed.getHTML(), ed.isEmpty);
      // Un blur peut être causé par un contrôle interne de la barre riche
      // (champ URL du lien, saisie de taille, sélecteur de couleur natif)
      // sans que l'utilisateur ait réellement quitté le bloc — on ne sort
      // du mode édition que si le focus est retombé en dehors de ce bloc
      // ET de sa barre (tous deux sous `boxRef`), vérifié après le tour de
      // boucle en cours pour laisser le nouveau focus se poser.
      requestAnimationFrame(() => {
        if (!boxRef.current?.contains(document.activeElement)) setIsEditing(false);
      });
    },
  }, [element.id]);

  /** Resynchronise le contenu affiché quand `element.html` change pour une
   * raison EXTERNE (Annuler/Rétablir, transfert cross-page du Lasso qui
   * réutiliserait le même id) — nécessaire car `useEditor` ci-dessus ne
   * recrée l'éditeur que si `element.id` change (voir ses deps), donc une
   * frappe committée puis annulée ne se reflèterait jamais à l'écran sans
   * ça. Ne s'applique JAMAIS pendant une édition active (`editor.isFocused`)
   * pour ne jamais couper une frappe en cours. */
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const next = element.html || "<p></p>";
    if (editor.getHTML() === next) return;
    editor.commands.setContent(next, false);
  }, [editor, element.html]);

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

  // useLayoutEffect (pas useEffect) : s'exécute avant que le navigateur ne
  // peigne, donc le plus tôt possible après le commit React — sur Safari/
  // iOS, ouvrir le clavier virtuel via .focus() programmatique exige de
  // rester au plus près du geste utilisateur d'origine (le tap qui a créé
  // ce bloc, voir NotesCanvas.tsx qui enveloppe cette création dans
  // flushSync pour la même raison) ; un useEffect classique s'exécute une
  // tâche plus tard et n'ouvre pas le clavier de façon fiable.
  useLayoutEffect(() => {
    if (autoFocus && editor) {
      editor.chain().focus("end").run();
    }
    // On ne veut ré-exécuter ceci que si l'instance d'éditeur change, pas à
    // chaque changement de `autoFocus` (qui redeviendrait vrai/faux au fil
    // des sélections d'autres blocs sans qu'on doive refocaliser celui-ci).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  /** Repositionne la barre riche flottante pour qu'elle reste dans la zone
   * réellement VISIBLE (pas seulement dans les limites de la page logique,
   * qui peut être bien plus grande que ce qui est actuellement affiché à
   * l'écran dans `containerRef`, conteneur scrollable — voir aussi
   * `window.visualViewport`, qui rétrécit sans redimensionner le DOM quand
   * le clavier iPad s'ouvre). Bascule sous le bloc si la place au-dessus
   * est insuffisante, et corrige un éventuel débordement horizontal —
   * useLayoutEffect pour mesurer/corriger avant peinture, sans clignotement. */
  useLayoutEffect(() => {
    if (!selected) return;
    const container = containerRef.current;
    if (!container) return;

    function recompute() {
      const box = boxRef.current;
      const wrapper = toolbarWrapperRef.current;
      if (!box || !wrapper || !container) return;
      const boxRect = box.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const vv = window.visualViewport;
      const visibleTop = Math.max(containerRect.top, vv ? vv.offsetTop : 0);
      const visibleBottom = Math.min(containerRect.bottom, vv ? vv.offsetTop + vv.height : window.innerHeight);
      const visibleLeft = Math.max(containerRect.left, vv ? vv.offsetLeft : 0);
      const visibleRight = Math.min(containerRect.right, vv ? vv.offsetLeft + vv.width : window.innerWidth);

      const spaceAbove = boxRect.top - visibleTop;
      const spaceBelow = visibleBottom - boxRect.bottom;
      const toolbarSpan = wrapperRect.height + TOOLBAR_MARGIN_PX;
      // Sous le bloc seulement si ça ne rentre vraiment pas au-dessus ET
      // qu'il y a effectivement plus de place en dessous — évite de
      // basculer inutilement si les deux côtés sont également serrés.
      const below = spaceAbove < toolbarSpan && spaceBelow > spaceAbove;

      let offsetX = 0;
      const wrapperLeft = boxRect.left;
      const wrapperRight = wrapperLeft + wrapperRect.width;
      if (wrapperRight > visibleRight) offsetX -= wrapperRight - visibleRight;
      if (wrapperLeft + offsetX < visibleLeft) offsetX += visibleLeft - (wrapperLeft + offsetX);

      setToolbarPos((prev) => (prev.below === below && prev.offsetX === offsetX ? prev : { below, offsetX }));
    }

    recompute();
    container.addEventListener("scroll", recompute, { passive: true });
    window.addEventListener("resize", recompute);
    window.visualViewport?.addEventListener("resize", recompute);
    window.visualViewport?.addEventListener("scroll", recompute);
    return () => {
      container.removeEventListener("scroll", recompute);
      window.removeEventListener("resize", recompute);
      window.visualViewport?.removeEventListener("resize", recompute);
      window.visualViewport?.removeEventListener("scroll", recompute);
    };
  }, [selected, element.x, element.y, element.width, containerRef]);

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
  // Édition vs Manipulation (voir `isEditing` ci-dessus) : les poignées de
  // déplacement/redimensionnement/suppression ne doivent jamais apparaître
  // pendant qu'on tape — seulement une fois le bloc sélectionné pour de
  // vrai sans curseur actif dedans (ex. via sa poignée de déplacement, ou
  // juste après en être sorti par la barre riche sans blur réel).
  const showManipulationHandles = selected && !isEditing;

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
        <div
          ref={toolbarWrapperRef}
          className="absolute left-0 z-20 w-max max-w-[90vw]"
          style={
            toolbarPos.below
              ? { top: "100%", marginTop: TOOLBAR_MARGIN_PX, transform: `translateX(${toolbarPos.offsetX}px)` }
              : { bottom: "100%", marginBottom: TOOLBAR_MARGIN_PX, transform: `translateX(${toolbarPos.offsetX}px)` }
          }
        >
          <RichTextToolbar editor={editor} />
        </div>
      )}

      <div className={`relative rounded-md px-2 py-1 ${selected ? "ring-2 ring-accent ring-offset-2 ring-offset-card" : ""}`}>
        {showManipulationHandles && (
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

        {showManipulationHandles && (
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

        {/* Suppression — visible seulement en mode Manipulation (sélectionné,
            pas en train d'éditer) avec l'outil Texte actif (interactive),
            jamais en survol Lasso/autre outil : icône Corbeille plutôt
            qu'un simple "×" pour que l'intention "supprimer le bloc" (pas
            juste le désélectionner) soit immédiate. */}
        {showManipulationHandles && interactive && (
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
