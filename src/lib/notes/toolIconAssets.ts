/** Architecture d'assets pour les icônes de la barre d'outils Notes.
 *
 * Chaque outil peut recevoir une image réaliste (PNG/WebP/SVG transparent)
 * déposée dans `public/tools/`, référencée ici par son chemin public
 * (ex. "/tools/pen-fineliner.png"). Tant qu'aucun fichier n'est fourni, la
 * valeur reste `null` et `ToolIconAsset` (voir components/notes/ToolIconAsset.tsx)
 * retombe sur l'icône SVG plate existante — remplacer une icône ne demande
 * donc que d'ajouter le fichier et de renseigner son chemin ici, sans toucher
 * au code des composants.
 */
export type ToolIconKey =
  | "pen-fineliner"
  | "pen-ballpoint"
  | "pen-crayon"
  | "highlighter"
  | "eraser"
  | "ruler"
  | "lasso"
  | "text"
  | "note"
  | "photo"
  | "shapes"
  | "pan"
  | "undo"
  | "redo";

export const TOOL_ICON_ASSETS: Record<ToolIconKey, string | null> = {
  "pen-fineliner": null,
  "pen-ballpoint": null,
  "pen-crayon": null,
  highlighter: null,
  eraser: null,
  ruler: null,
  lasso: null,
  text: null,
  note: null,
  photo: null,
  shapes: null,
  pan: null,
  undo: null,
  redo: null,
};
