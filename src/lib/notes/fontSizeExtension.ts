import TextStyle from "@tiptap/extension-text-style";
import type { ChainedCommands } from "@tiptap/core";

/** Étend la marque `textStyle` de TipTap avec un attribut `fontSize`
 * (en px) — TipTap ne fournit pas d'extension officielle pour la taille de
 * police, mais c'est le mécanisme documenté pour en ajouter une : une
 * marque existante (ici `textStyle`, déjà utilisée par `Color`/
 * `FontFamily`) peut porter plusieurs attributs à la fois, rendus comme un
 * seul `<span style="...">`. */
export const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize?.replace("px", "") || null,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}px` };
        },
      },
    };
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setFontSize:
        (fontSize: number) =>
        ({ chain }: { chain: () => ChainedCommands }) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }: { chain: () => ChainedCommands }) =>
          chain().setMark("textStyle", { fontSize: null }).run(),
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: number) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}
