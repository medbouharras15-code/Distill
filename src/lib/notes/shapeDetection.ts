import type { ShapeElement, StrokePoint } from "./types";

/** Résultat d'une détection : soit une forme propre (cercle/rectangle), soit
 * un trait redressé (deux points alignés), soit rien si le tracé ne
 * ressemble à aucun des deux. */
export type ShapeDetectionResult =
  | { kind: "shape"; shape: Omit<ShapeElement, "id" | "color" | "strokeWidth"> }
  | { kind: "line"; points: [StrokePoint, StrokePoint] }
  | null;

function boundingBox(points: StrokePoint[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function distanceToSegment(x1: number, y1: number, x2: number, y2: number, x: number, y: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(x - x1, y - y1);
  let t = ((x - x1) * dx + (y - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

/** Un trait est-il globalement fermé (le point de départ et d'arrivée sont
 * proches l'un de l'autre, par rapport à la taille du tracé) ? */
function isClosedLoop(points: StrokePoint[], box: ReturnType<typeof boundingBox>): boolean {
  const span = Math.max(box.width, box.height);
  if (span < 18) return false;
  const first = points[0];
  const last = points[points.length - 1];
  return Math.hypot(last.x - first.x, last.y - first.y) <= span * 0.28;
}

function tryCircle(points: StrokePoint[], box: ReturnType<typeof boundingBox>): ShapeDetectionResult {
  if (Math.max(box.width, box.height) < 18) return null;
  const aspect = box.width / box.height;
  if (aspect < 0.5 || aspect > 2) return null;

  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const radii = points.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const avgR = radii.reduce((a, b) => a + b, 0) / radii.length;
  if (avgR < 8) return null;

  const variance = radii.reduce((sum, r) => sum + (r - avgR) ** 2, 0) / radii.length;
  const coefficientOfVariation = Math.sqrt(variance) / avgR;
  // Un rectangle a des coins nettement plus loin du centre que le milieu de
  // ses côtés, ce qui produit une variation de rayon bien plus élevée qu'un
  // cercle tracé à main levée (même approximatif) — seuil volontairement
  // strict pour ne pas confondre les deux.
  if (coefficientOfVariation > 0.14) return null;

  return {
    kind: "shape",
    shape: { type: "circle", x: box.minX, y: box.minY, width: box.width, height: box.height },
  };
}

function tryRectangle(points: StrokePoint[], box: ReturnType<typeof boundingBox>): ShapeDetectionResult {
  if (box.width < 18 || box.height < 18) return null;
  const tolerance = Math.max(10, Math.max(box.width, box.height) * 0.12);

  const edges: [number, number, number, number][] = [
    [box.minX, box.minY, box.maxX, box.minY],
    [box.maxX, box.minY, box.maxX, box.maxY],
    [box.maxX, box.maxY, box.minX, box.maxY],
    [box.minX, box.maxY, box.minX, box.minY],
  ];

  let onEdge = 0;
  for (const p of points) {
    const closest = Math.min(...edges.map(([x1, y1, x2, y2]) => distanceToSegment(x1, y1, x2, y2, p.x, p.y)));
    if (closest <= tolerance) onEdge++;
  }

  if (onEdge / points.length < 0.82) return null;

  return {
    kind: "shape",
    shape: { type: "rectangle", x: box.minX, y: box.minY, width: box.width, height: box.height },
  };
}

/** Redresse un trait à main levée en ligne parfaitement droite (et l'aligne
 * sur les angles à 45° si on en est déjà proche) dès lors qu'il s'en
 * approchait suffisamment — utilisé à chaque lever de stylet, sans geste de
 * maintien requis, pour souligner du texte à la volée comme dans Notability. */
export function detectStraightLine(points: StrokePoint[]): ShapeDetectionResult {
  if (points.length < 3) return null;
  return tryStraightLine(points);
}

function tryStraightLine(points: StrokePoint[]): ShapeDetectionResult {
  const first = points[0];
  const last = points[points.length - 1];
  const length = Math.hypot(last.x - first.x, last.y - first.y);
  if (length < 24) return null;

  let maxDeviation = 0;
  for (const p of points) {
    const d = distanceToSegment(first.x, first.y, last.x, last.y, p.x, p.y);
    if (d > maxDeviation) maxDeviation = d;
  }
  if (maxDeviation / length > 0.09) return null;

  // Alignement doux : si l'angle du trait est proche d'un multiple de 45°,
  // on l'y aligne exactement (horizontale, verticale, diagonales).
  const angle = Math.atan2(last.y - first.y, last.x - first.x);
  const step = Math.PI / 4;
  const nearest = Math.round(angle / step) * step;
  const angleDiff = Math.abs(angle - nearest);
  const finalAngle = angleDiff <= (4 * Math.PI) / 180 ? nearest : angle;

  const end = {
    x: first.x + Math.cos(finalAngle) * length,
    y: first.y + Math.sin(finalAngle) * length,
    pressure: last.pressure,
  };

  return { kind: "line", points: [{ ...first }, end] };
}

/** Analyse un trait à main levée en cours (le stylo est toujours appuyé) et
 * tente de le reconnaître comme un cercle, un rectangle ou un trait droit.
 * Retourne `null` si rien ne correspond suffisamment — le trait reste alors
 * inchangé. */
export function detectFreehandShape(points: StrokePoint[]): ShapeDetectionResult {
  if (points.length < 8) return null;
  const box = boundingBox(points);

  if (isClosedLoop(points, box)) {
    // Le rectangle est testé en premier : son critère (adhérence aux 4
    // bords) est plus spécifique et moins susceptible de se déclencher par
    // erreur sur un vrai cercle que l'inverse.
    return tryRectangle(points, box) ?? tryCircle(points, box);
  }
  return tryStraightLine(points);
}
