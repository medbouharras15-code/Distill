/** Architecture d'assets pour les icônes de la barre d'outils Notes.
 *
 * Chaque outil peut recevoir une image réaliste (PNG/WebP transparent,
 * gabarit détaillé dans public/tools/README.md) déposée dans
 * `public/tools/`, référencée ici par son chemin public
 * (ex. "/tools/pen-fineliner.png"). Tant qu'une entrée reste à `null`, la
 * valeur reste `null` et `ToolIconAsset` (voir components/notes/ToolIconAsset.tsx)
 * retombe sur l'icône SVG plate existante — activer une icône ne demande
 * donc que d'ajouter le fichier et de renseigner son chemin ici, sans toucher
 * au code des composants ni au comportement de la barre.
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

/** Chemin public de chaque icône. Les 8 clés ci-dessous (stylo plume, stylo
 * bille, crayon, surligneur, gomme, règle, lasso, note) sont le jeu
 * prioritaire à habiller d'illustrations réalistes/3D ; les autres
 * (texte, photo, formes, déplacement, annuler/rétablir) restent en icône
 * plate — non demandées, pas de raison de les changer. */
export const TOOL_ICON_ASSETS: Record<ToolIconKey, string | null> = {
  "pen-fineliner": "/tools/pen-fineliner.webp",
  "pen-ballpoint": "/tools/pen-ballpoint.webp",
  "pen-crayon": "/tools/pen-crayon.webp",
  highlighter: "/tools/highlighter.webp",
  eraser: "/tools/eraser.webp",
  ruler: "/tools/ruler.webp",
  lasso: "/tools/lasso.webp",
  note: "/tools/note.webp",
  text: null,
  photo: null,
  shapes: null,
  pan: null,
  undo: null,
  redo: null,
};
