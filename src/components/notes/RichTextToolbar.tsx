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

/** Sélection volontairement restreinte à 3 familles réellement utiles
 * (pas 50 polices) : Sans reprend la police de marque déjà par défaut
 * (`.notes-textbox-prose`, Inter) ; Serif utilise Georgia, une police
 * système déjà présente sur iPad/Mac (aucune dépendance à charger) ; Mono
 * réutilise `var(--font-mono)`, la police déjà chargée par l'app
 * (`src/app/layout.tsx`, Geist Mono) plutôt qu'une police système
 * générique — aucune nouvelle dépendance de police dans les trois cas. */
export const TEXT_FONT_FAMILIES: { label: string; value: string }[] = [
  { label: "Sans", value: "Inter, sans-serif" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Mono", value: "var(--font-mono), monospace" },
];

/** Valeurs rapides proposées en plus de l'ajustement fin (+/-) ci-dessous. */
const QUICK_FONT_SIZES = [12, 14, 16, 18, 24, 32];

/** "Auto" (premier swatch) retire la couleur inline (`unsetColor`) plutôt
 * que de fixer un hex : le texte hérite alors de `var(--foreground)`
 * (voir .notes-textbox-prose, globals.css), donc reste lisible aussi bien
 * en clair qu'en sombre. Les teintes fixes suivantes sont volontairement à
 * mi-luminosité (ni proches du noir ni du blanc pur) pour rester lisibles
 * sur les deux fonds. */
const TEXT_COLORS: { label: string; value: string | null }[] = [
  { label: "Auto", value: null },
  { label: "Gris", value: "#8a8a8a" },
  { label: "Rouge", value: "#c0524a" },
  { label: "Bleu", value: "#4a7fc0" },
  { label: "Vert", value: "#4a9e73" },
  { label: "Violet", value: "#8a63b8" },
  { label: "Orange", value: "#c98a3e" },
];

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
  // `null` = aucune couleur inline (hérite de var(--foreground), voir
  // TEXT_COLORS "Auto") — le picker natif ci-dessous, lui, a besoin d'une
  // vraie valeur hex à afficher même dans ce cas.
  const currentColor: string | null = editor.getAttributes("textStyle").color || null;

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
      {/* Police */}
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

      {/* 3a. Taille de police — valeurs rapides */}
      <select
        value={QUICK_FONT_SIZES.includes(currentFontSize) ? currentFontSize : -1}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (next > 0) editor.chain().focus().setFontSize(next).run();
        }}
        aria-label="Taille rapide"
        title="Taille rapide"
        className="shrink-0 rounded-full border border-border bg-background-alt px-2.5 py-1 text-xs font-medium text-foreground"
      >
        {/* Option injectée seulement si la taille courante ne fait pas partie
            des valeurs rapides — pour ne jamais l'écraser silencieusement
            (ex. une taille choisie via le +/- ci-dessous). */}
        {!QUICK_FONT_SIZES.includes(currentFontSize) && <option value={-1}>{currentFontSize}</option>}
        {QUICK_FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>

      {/* 3b. Taille de police — ajustement fin */}
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

      {/* Couleur de texte — pastilles rapides (voir TEXT_COLORS : "Auto"
          hérite du thème, les autres sont des teintes fixes lisibles en
          clair comme en sombre). La couleur personnalisée (sélecteur natif)
          est dans "…", pas ici — usage rare, ligne principale réservée à
          l'essentiel (voir la demande : Police/Taille/B/I/U/Couleur/
          Alignement/Liste, tout le reste en secondaire). */}
      <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-background-alt px-1 py-1">
        {TEXT_COLORS.map((c) => (
          <button
            key={c.label}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (c.value ? editor.chain().focus().setColor(c.value).run() : editor.chain().focus().unsetColor().run())}
            aria-label={c.label}
            aria-pressed={currentColor === c.value}
            title={c.label}
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${
              currentColor === c.value ? "border-accent" : "border-transparent hover:border-border"
            }`}
          >
            <span
              aria-hidden="true"
              className="h-4 w-4 rounded-full border border-border/60"
              style={c.value ? { backgroundColor: c.value } : { background: "var(--foreground)", opacity: 0.6 }}
            />
          </button>
        ))}
      </div>

      <div className="h-6 w-px shrink-0 bg-border" />

      {/* Gras / italique / souligné */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} label="Gras">
        <BoldIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} label="Italique">
        <ItalicIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} label="Souligné">
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>

      {/* Plus d'options — tout ce qui n'est pas dans la priorité demandée
          (Police/Taille/B/I/U/Couleur/Alignement/Liste) : style de
          paragraphe (titres/citation), lien, liste de tâches, citation en
          bloc dédiée, bloc de code, retrait, barré/exposant/indice, couleur
          personnalisée. Regroupé en grille compacte plutôt qu'une ligne qui
          déborderait. */}
      <div className="relative shrink-0">
        <ToolbarButton
          onClick={() => {
            setMoreOpen((open) => !open);
            setLinkOpen(false);
          }}
          active={
            moreOpen ||
            editor.isActive("strike") ||
            editor.isActive("superscript") ||
            editor.isActive("subscript") ||
            editor.isActive("link") ||
            editor.isActive("blockquote") ||
            editor.isActive("codeBlock") ||
            editor.isActive("taskList") ||
            paragraphValue !== "body"
          }
          label="Plus d'options de texte"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </ToolbarButton>
        {moreOpen && (
          <div className="absolute left-0 top-full z-10 mt-1 flex w-64 flex-col gap-1.5 rounded-xl border border-border bg-card p-2 shadow-lg">
            <select
              value={paragraphValue}
              onChange={(e) => applyParagraphStyle(e.target.value)}
              aria-label="Style de paragraphe"
              title="Style de paragraphe"
              className="w-full rounded-full border border-border bg-background-alt px-2.5 py-1 text-xs font-medium text-foreground"
            >
              <option value="body">Corps</option>
              <option value="h1">Titre 1</option>
              <option value="h2">Titre 2</option>
              <option value="h3">Titre 3</option>
              <option value="quote">Citation</option>
            </select>

            <div className="flex flex-wrap items-center gap-1">
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
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                active={editor.isActive("taskList")}
                label="Liste de tâches"
              >
                <ChecklistIcon className="h-4 w-4" />
              </ToolbarButton>
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
              <ToolbarButton onClick={openLinkPopover} active={linkOpen || editor.isActive("link")} label="Insérer un lien">
                <LinkIcon className="h-4 w-4" />
              </ToolbarButton>
              <span className="relative grid h-8 w-8 shrink-0 place-items-center" title="Couleur personnalisée">
                <input
                  type="color"
                  value={currentColor || "#8a8a8a"}
                  onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                  aria-label="Couleur personnalisée du texte"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none h-4 w-4 rounded-full border border-border"
                  style={{ backgroundColor: currentColor || "transparent" }}
                />
              </span>
            </div>

            {linkOpen && (
              <div className="flex items-center gap-1.5">
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
                  className="w-full min-w-0 rounded-full border border-border bg-background-alt px-3 py-1 text-xs text-foreground outline-none"
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
        )}
      </div>

      <div className="h-6 w-px shrink-0 bg-border" />

      {/* Liste — à puces / numérotée (la liste de tâches, plus spécialisée,
          est dans "…" ci-dessus). */}
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

      <div className="h-6 w-px shrink-0 bg-border" />

      {/* Alignement */}
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
