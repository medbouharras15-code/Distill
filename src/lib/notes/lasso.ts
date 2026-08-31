import type { ImageElement, ShapeElement, Stroke, TextBoxElement } from "./types";

/** Géométrie/transformations pures pour le Lasso — aucune dépendance à
 * React/DOM, toutes les coordonnées en unités logiques de page (même
 * repère que `Stroke.points`/getPos()), donc déjà correctes à tout niveau
 * de zoom sans rien faire de spécial ici. */

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Contenu du presse-papiers interne du Lasso — copie profonde des
 * éléments sélectionnés au moment de Copier/Couper. Partagé au niveau de
 * NotesPageClient (pas local à une page) pour permettre Page 1 → Copier →
 * Page 2 → Coller au sein du même carnet (voir plan validé) ; jamais l'API
 * Clipboard système (non fiable pour des objets structurés dans Safari). */
export interface LassoClipboardData {
  strokes: Stroke[];
  shapes: ShapeElement[];
  images: ImageElement[];
  textBoxes: TextBoxElement[];
}

/** Écart minimal (unités logiques) entre deux points consécutifs conservés
 * du tracé du lasso pendant le geste — évite un polygone à des milliers de
 * points sur un geste lent, sans perte visuelle perceptible. */
export const LASSO_MIN_POINT_SPACING = 3;

/** Fraction des points d'un trait qui doit tomber dans le polygone du
 * lasso pour que le trait *entier* soit sélectionné (jamais découpé,
 * voir §2 du plan validé) — ajustable après test. */
export const LASSO_STROKE_SELECT_THRESHOLD = 0.6;

/** Nombre minimum (sur 5 : les 4 coins de la bbox + son centre) qui doit
 * tomber dans le polygone pour qu'une forme/photo/bloc de texte soit
 * sélectionné — évite un calcul d'aire d'intersection polygone/rectangle,
 * reste un test "raisonnable" à 5 points. */
export const LASSO_ELEMENT_SELECT_SAMPLES_REQUIRED = 3;

/** Décalage (unités logiques) appliqué à une duplication ou à un collage,
 * pour que la copie reste visuellement distincte de l'original. */
export const DUPLICATE_OFFSET = 16;

/** Marge (pixels écran) depuis le bord haut/bas du conteneur de défilement
 * partagé en dessous de laquelle l'auto-scroll du drag cross-page du Lasso
 * se déclenche — assez large pour rester confortable au doigt sur iPad. */
export const AUTO_SCROLL_EDGE_PX = 56;

/** Vitesse de défilement (pixels/frame) pendant l'auto-scroll — volontairement
 * douce (voir demande : "auto-scroll doux"), constante quelle que soit la
 * distance au bord plutôt que proportionnelle, pour rester prévisible. */
export const AUTO_SCROLL_SPEED_PX = 10;

/** Échelle minimale autorisée pendant un redimensionnement — évite qu'un
 * geste de poignée trop rapide ne fasse s'effondrer/inverser la sélection. */
export const MIN_SELECTION_SCALE = 0.05;

/** Rayon (unités logiques) des poignées de coin de la boîte englobante —
 * même valeur que `IMAGE_HANDLE_RADIUS` (canvasUtils.ts) pour rester
 * visuellement cohérent avec la sélection d'image déjà existante. */
export const SELECTION_HANDLE_RADIUS = 9;

/** Retire les points du tracé du lasso plus proches que
 * `LASSO_MIN_POINT_SPACING` du dernier point conservé. */
export function simplifyLassoPath(points: Point[], minSpacing = LASSO_MIN_POINT_SPACING): Point[] {
  if (points.length === 0) return points;
  const result: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const last = result[result.length - 1];
    const p = points[i];
    if (Math.hypot(p.x - last.x, p.y - last.y) >= minSpacing) result.push(p);
  }
  return result;
}

/** Test point-dans-polygone standard (ray casting). */
export function pointInPolygon(polygon: Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function boundsOfPoints(points: Point[]): Bounds {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

export function unionBounds(a: Bounds, b: Bounds): Bounds {
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;
}

export function strokeBounds(stroke: Pick<Stroke, "points">): Bounds {
  return boundsOfPoints(stroke.points);
}

export function boxBounds(el: { x: number; y: number; width: number; height: number }): Bounds {
  return {
    x0: Math.min(el.x, el.x + el.width),
    x1: Math.max(el.x, el.x + el.width),
    y0: Math.min(el.y, el.y + el.height),
    y1: Math.max(el.y, el.y + el.height),
  };
}

export function textBoxBounds(box: Pick<TextBoxElement, "x" | "y" | "width">, height: number): Bounds {
  return { x0: box.x, y0: box.y, x1: box.x + box.width, y1: box.y + height };
}

/** Vrai si une "grande majorité" des points du trait tombe dans le
 * polygone — le trait entier est alors sélectionné, jamais découpé. */
export function strokeMostlyInPolygon(
  stroke: Pick<Stroke, "points">,
  polygon: Point[],
  threshold = LASSO_STROKE_SELECT_THRESHOLD,
): boolean {
  const { points } = stroke;
  if (points.length === 0) return false;
  let count = 0;
  for (const p of points) if (pointInPolygon(polygon, p.x, p.y)) count++;
  return count / points.length >= threshold;
}

/** Vrai si au moins `required` des 5 points échantillonnés de la bbox (4
 * coins + centre) tombent dans le polygone — utilisé pour formes/photos/
 * blocs de texte plutôt qu'une intersection d'aire polygone/rectangle. */
export function boundsMostlyInPolygon(
  bounds: Bounds,
  polygon: Point[],
  required = LASSO_ELEMENT_SELECT_SAMPLES_REQUIRED,
): boolean {
  const samples: Point[] = [
    { x: bounds.x0, y: bounds.y0 },
    { x: bounds.x1, y: bounds.y0 },
    { x: bounds.x1, y: bounds.y1 },
    { x: bounds.x0, y: bounds.y1 },
    { x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2 },
  ];
  let count = 0;
  for (const s of samples) if (pointInPolygon(polygon, s.x, s.y)) count++;
  return count >= required;
}

// ---------------------------------------------------------------------------
// Transformations — chaque fonction ne touche que les champs pertinents pour
// son type, jamais le rendu (canvasUtils.ts n'est pas concerné). Les
// versions "single" sont utilisées à la fois pour l'aperçu en direct
// (un seul élément recalculé au vol pendant le dessin, voir renderAll) et,
// via un simple .map(), pour la transformation finale au commit — même
// calcul dans les deux cas, jamais deux implémentations à maintenir.
// ---------------------------------------------------------------------------

export function translateStroke(stroke: Stroke, dx: number, dy: number): Stroke {
  return { ...stroke, points: stroke.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) };
}

export function translateShape(shape: ShapeElement, dx: number, dy: number): ShapeElement {
  return { ...shape, x: shape.x + dx, y: shape.y + dy };
}

export function translateImage(image: ImageElement, dx: number, dy: number): ImageElement {
  return { ...image, x: image.x + dx, y: image.y + dy };
}

export function translateTextBox(box: TextBoxElement, dx: number, dy: number): TextBoxElement {
  return { ...box, x: box.x + dx, y: box.y + dy };
}

/** Translate les 4 tableaux d'un `LassoClipboardData` d'un même (dx, dy) —
 * même ids, aucune copie/nouvel id (contrairement à `insertClipboardData`
 * côté NotesCanvas) : sert au drag cross-page du Lasso, qui déplace
 * réellement des éléments d'une page vers une autre plutôt que d'en copier
 * le contenu. Repère logique déjà commun à toutes les pages (voir
 * LassoClipboardData), donc un simple (dx, dy) suffit ici aussi. */
export function translateAll(data: LassoClipboardData, dx: number, dy: number): LassoClipboardData {
  return {
    strokes: data.strokes.map((s) => translateStroke(s, dx, dy)),
    shapes: data.shapes.map((s) => translateShape(s, dx, dy)),
    images: data.images.map((img) => translateImage(img, dx, dy)),
    textBoxes: data.textBoxes.map((tb) => translateTextBox(tb, dx, dy)),
  };
}

function scalePoint(p: Point, anchor: Point, scale: number): Point {
  return { x: anchor.x + (p.x - anchor.x) * scale, y: anchor.y + (p.y - anchor.y) * scale };
}

export function scaleStroke(stroke: Stroke, anchor: Point, scale: number): Stroke {
  return {
    ...stroke,
    size: stroke.size * scale,
    points: stroke.points.map((p) => ({ ...p, ...scalePoint(p, anchor, scale) })),
  };
}

export function scaleShape(shape: ShapeElement, anchor: Point, scale: number): ShapeElement {
  const p0 = scalePoint({ x: shape.x, y: shape.y }, anchor, scale);
  const p1 = scalePoint({ x: shape.x + shape.width, y: shape.y + shape.height }, anchor, scale);
  return { ...shape, x: p0.x, y: p0.y, width: p1.x - p0.x, height: p1.y - p0.y, strokeWidth: shape.strokeWidth * scale };
}

export function scaleImage(image: ImageElement, anchor: Point, scale: number): ImageElement {
  const p0 = scalePoint({ x: image.x, y: image.y }, anchor, scale);
  const p1 = scalePoint({ x: image.x + image.width, y: image.y + image.height }, anchor, scale);
  return { ...image, x: p0.x, y: p0.y, width: p1.x - p0.x, height: p1.y - p0.y };
}

/** Le texte n'a pas de hauteur stockée (elle s'ajuste au contenu, voir
 * TextBoxElement) : seule la largeur est mise à l'échelle, la hauteur
 * continue de se recalculer naturellement au rendu — le contenu lui-même
 * n'est jamais touché. */
const MIN_TEXTBOX_SCALED_WIDTH = 40;

export function scaleTextBox(box: TextBoxElement, anchor: Point, scale: number): TextBoxElement {
  const p0 = scalePoint({ x: box.x, y: box.y }, anchor, scale);
  const p1x = anchor.x + (box.x + box.width - anchor.x) * scale;
  return { ...box, x: p0.x, y: p0.y, width: Math.max(MIN_TEXTBOX_SCALED_WIDTH, p1x - p0.x) };
}
