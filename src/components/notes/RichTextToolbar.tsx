"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BlockquoteIcon,
  BoldIcon,
  BulletListIcon,
  ChecklistIcon,
  ChevronDownIcon,
  CodeBlockIcon,
  IndentDecreaseIcon,
  IndentIncreaseIcon,
  ItalicIcon,
  LinkIcon,
  NumberedListIcon,
  StrikethroughIcon,
  SubscriptIcon,
  SuperscriptIcon,
  UnderlineIcon,
} from "./icons";

export const TEXT_FONT_FAMILIES: { label: string; value: string }[] = [
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Fraunces", value: "Fraunces, serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Verdana", value: "Verdana, sans-serif" },
];

const TEXT_COLORS = ["#1f1b16", "#a83e35", "#2f6b4f", "#3d6fa8", "#8a6a37", "#7451a8"];

const ALIGN_OPTIONS: { value: "left" | "center" | "right" | "justify"; label: string; icon: React.ReactNode }[] = [
  { value: "left", label: "Aligner à gauche", icon: <AlignLeftIcon className="h-4 w-4" /> },
  { value: "center", label: "Centrer", icon: <AlignCenterIcon className="h-4 w-4" /> },
  { value: "right", label: "Aligner à droite", icon: <AlignRightIcon className="h-4 w-4" /> },
  { value: "justify", label: "Justifier", icon: <AlignJustifyIcon className="h-4 w-4" /> },
];

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition disabled:opacity-30 ${
        active
          ? "border-accent bg-accent-light text-accent-dark"
          : "border-transparent text-foreground hover:bg-background-alt"
      }`}
    >
      {children}
    </button>
  );
}

/** Barre d'outils d'édition de texte riche façon Notion : apparaît
 * au-dessus d'un bloc de texte dès qu'il prend le focus. Entièrement pilotée
 * par l'instance d'éditeur TipTap passée en prop — chaque contrôle lit son
 * état actif directement depuis `editor` (aucun état dupliqué côté React
 * pour le formatage lui-même, seulement pour les petits menus ouverts/fermés
 * de cette barre). */
export function RichTextToolbar({ editor }: { editor: Editor }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [alignOpen, setAlignOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
        setLinkOpen(false);
        setAlignOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, []);

  const paragraphValue = editor.isActive("heading", { level: 1 })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
      ? "h2"
      : editor.isActive("heading", { level: 3 })
        ? "h3"
        : editor.isActive("blockquote")
          ? "quote"
          : "body";

  const currentFontFamily = editor.getAttributes("textStyle").fontFamily || TEXT_FONT_FAMILIES[0].value;
  const currentFontSize = Number(editor.getAttributes("textStyle").fontSize) || 14;
  const currentColor = editor.getAttributes("textStyle").color || "#1f1b16";

  const alignValue = editor.isActive({ textAlign: "center" })
    ? "center"
    : editor.isActive({ textAlign: "right" })
      ? "right"
      : editor.isActive({ textAlign: "justify" })
        ? "justify"
        : "left";

  function applyParagraphStyle(value: string) {
    const chain = editor.chain().focus();
    if (value === "h1") chain.setHeading({ level: 1 }).run();
    else if (value === "h2") chain.setHeading({ level: 2 }).run();
    else if (value === "h3") chain.setHeading({ level: 3 }).run();
    else if (value === "quote") chain.setBlockquote().run();
    else chain.setParagraph().run();
  }

  function openLinkPopover() {
    setLinkDraft(editor.getAttributes("link").href || "");
    setLinkOpen((open) => !open);
    setMoreOpen(false);
  }

  function applyLink() {
    if (linkDraft.trim()) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: linkDraft.trim() }).run();
    } else {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    }
    setLinkOpen(false);
  }

  function removeLink() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className="flex flex-nowrap items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card px-2 py-1.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25)]"
      // Empêche le mousedown sur la barre de faire perdre le focus (et donc
      // la sélection) de l'éditeur avant que le clic ne soit traité.
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault();
      }}
    >
      {/* 1. Style de paragraphe */}
      <select
        value={paragraphValue}
        onChange={(e) => applyParagraphStyle(e.target.value)}
        aria-label="Style de paragraphe"
        title="Style de paragraphe"
        className="shrink-0 rounded-full border border-border bg-background-alt px-2.5 py-1 text-xs font-medium text-foreground"
      >
        <option value="body">Corps</option>
        <option value="h1">Titre 1</option>
        <option value="h2">Titre 2</option>
        <option value="h3">Titre 3</option>
        <option value="quote">Citation</option>
      </select>

      {/* 2. Police */}
      <select
        value={currentFontFamily}
        onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
        aria-label="Police"
        title="Police"
        className="shrink-0 rounded-full border border-border bg-background-alt px-2.5 py-1 text-xs font-medium text-foreground"
        style={{ fontFamily: currentFontFamily }}
      >
        {TEXT_FONT_FAMILIES.map((f) => (
          <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
            {f.label}
          </option>
        ))}
      </select>

      {/* 3. Taille de police */}
      <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-background-alt px-1 py-1">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().setFontSize(Math.max(8, currentFontSize - 1)).run()}
          aria-label="Réduire la taille"
          title="Réduire la taille"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-foreground hover:bg-card"
        >
          −
        </button>
        <input
          type="number"
          value={currentFontSize}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isFinite(next) && next > 0) editor.chain().focus().setFontSize(next).run();
          }}
          aria-label="Taille de police"
          title="Taille de police"
          className="w-9 shrink-0 bg-transparent text-center text-xs font-medium text-foreground outline-none"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().setFontSize(Math.min(96, currentFontSize + 1)).run()}
          aria-label="Augmenter la taille"
          title="Augmenter la taille"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-foreground hover:bg-card"
        >
          +
        </button>
      </div>

      {/* 4. Couleur de texte */}
      <span className="relative h-8 w-8 shrink-0" title="Couleur du texte">
        <input
          type="color"
          value={currentColor}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          aria-label="Couleur du texte"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-1.5 rounded-full border border-border"
          style={{ backgroundColor: currentColor }}
        />
      </span>

      <div className="h-6 w-px shrink-0 bg-border" />

      {/* 5-7. Gras / italique / souligné */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} label="Gras">
        <BoldIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} label="Italique">
        <ItalicIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} label="Souligné">
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>

      {/* 8. Plus d'options texte */}
      <div className="relative shrink-0">
        <ToolbarButton
          onClick={() => {
            setMoreOpen((open) => !open);
            setLinkOpen(false);
          }}
          active={moreOpen || editor.isActive("strike") || editor.isActive("superscript") || editor.isActive("subscript")}
          label="Plus d'options de texte"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </ToolbarButton>
        {moreOpen && (
          <div className="absolute left-0 top-full z-10 mt-1 flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-lg">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              active={editor.isActive("strike")}
              label="Barré"
            >
              <StrikethroughIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleSuperscript().run()}
              active={editor.isActive("superscript")}
              label="Exposant"
            >
              <SuperscriptIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleSubscript().run()}
              active={editor.isActive("subscript")}
              label="Indice"
            >
              <SubscriptIcon className="h-4 w-4" />
            </ToolbarButton>
          </div>
        )}
      </div>

      {/* 9. Lien */}
      <div className="relative shrink-0">
        <ToolbarButton onClick={openLinkPopover} active={linkOpen || editor.isActive("link")} label="Insérer un lien">
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        {linkOpen && (
          <div className="absolute left-0 top-full z-10 mt-1 flex items-center gap-1.5 rounded-xl border border-border bg-card p-2 shadow-lg">
            <input
              type="url"
              value={linkDraft}
              onChange={(e) => setLinkDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyLink();
                if (e.key === "Escape") setLinkOpen(false);
              }}
              placeholder="https://…"
              autoFocus
              className="w-44 rounded-full border border-border bg-background-alt px-3 py-1 text-xs text-foreground outline-none"
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={applyLink}
              className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground transition hover:bg-accent-dark"
            >
              Appliquer
            </button>
            {editor.isActive("link") && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={removeLink}
                className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs text-muted transition hover:text-foreground"
              >
                Retirer
              </button>
            )}
          </div>
        )}
      </div>

      <div className="h-6 w-px shrink-0 bg-border" />

      {/* 10-12. Listes */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        active={editor.isActive("taskList")}
        label="Liste de tâches"
      >
        <ChecklistIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        label="Liste à puces"
      >
        <BulletListIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        label="Liste numérotée"
      >
        <NumberedListIcon className="h-4 w-4" />
      </ToolbarButton>

      {/* 13-14. Citation / code */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        label="Citation en bloc"
      >
        <BlockquoteIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")}
        label="Bloc de code"
      >
        <CodeBlockIcon className="h-4 w-4" />
      </ToolbarButton>

      <div className="h-6 w-px shrink-0 bg-border" />

      {/* 15-16. Retrait */}
      <ToolbarButton
        onClick={() => editor.chain().focus().sinkListItem("listItem").run()}
        disabled={!editor.can().sinkListItem("listItem")}
        label="Augmenter le retrait"
      >
        <IndentIncreaseIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().liftListItem("listItem").run()}
        disabled={!editor.can().liftListItem("listItem")}
        label="Diminuer le retrait"
      >
        <IndentDecreaseIcon className="h-4 w-4" />
      </ToolbarButton>

      <div className="h-6 w-px shrink-0 bg-border" />

      {/* 17. Alignement */}
      <div className="relative shrink-0">
        <ToolbarButton onClick={() => setAlignOpen((open) => !open)} active={alignOpen} label="Alignement du texte">
          {ALIGN_OPTIONS.find((a) => a.value === alignValue)?.icon}
        </ToolbarButton>
        {alignOpen && (
          <div className="absolute right-0 top-full z-10 mt-1 flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-lg">
            {ALIGN_OPTIONS.map((a) => (
              <ToolbarButton
                key={a.value}
                onClick={() => {
                  editor.chain().focus().setTextAlign(a.value).run();
                  setAlignOpen(false);
                }}
                active={alignValue === a.value}
                label={a.label}
              >
                {a.icon}
              </ToolbarButton>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { TEXT_COLORS };
