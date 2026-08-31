/** Géométrie pure de la Règle numérique — aucune dépendance à React/DOM,
 * pour rester réutilisable si d'autres instruments similaires (Équerre,
 * Rapporteur, Compas) sont construits plus tard sans avoir à en extraire
 * une abstraction commune maintenant (prématuré avec un seul instrument
 * réel). Toutes les coordonnées sont en unités logiques de page — le même
 * repère que `StrokePoint`/`Stroke.points` — jamais en pixels écran : la
 * conversion écran→document se fait une seule fois, dans NotesCanvas.tsx
 * (getPos), donc cette précision au zoom est déjà acquise ici sans rien
 * faire de spécial. */

export interface RulerState {
  /** Centre de la règle. */
  x: number;
  y: number;
  /** Rotation, degrés. */
  angleDeg: number;
}

/** Dimensions par défaut — indépendantes du format de papier, comme les
 * autres tailles de l'app (PEN_SIZES, ERASER_SIZES...) plutôt que
 * proportionnelles à PAGE_WIDTH/PAGE_HEIGHT. */
export const RULER_LENGTH = 520;
export const RULER_THICKNESS = 78;

/** Distance (unités logiques de page) sous laquelle le Pencil "accroche"
 * un bord de la règle au démarrage d'un trait — voir NotesCanvas.tsx.
 * Centralisée ici pour rester facile à ajuster après test réel sur iPad :
 * plus grand = accroche plus tolérante (facile à viser sans trembler) mais
 * risque d'attirer un trait qui devait rester libre ; plus petit =
 * l'inverse. 16 est un point de départ raisonnable (à mi-chemin entre la
 * plus petite taille de Stylo, 1.5, et la plus grande gomme, 36). */
export const RULER_SNAP_THRESHOLD = 16;

/** Angles remarquables (degrés) auxquels la rotation s'accroche légèrement
 * — la base 0/30/45/60/90 demandée, répétée tous les 90° pour couvrir les
 * 4 cadrans (une règle tournée au-delà de 90° doit continuer d'accrocher). */
const SNAP_ANGLES_DEG = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
const ANGLE_SNAP_THRESHOLD_DEG = 3;

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Écart angulaire le plus court entre deux angles (degrés, 0-180). */
function angleDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Accroche `angleDeg` au plus proche angle remarquable si l'écart est
 * sous `ANGLE_SNAP_THRESHOLD_DEG`, sinon le renvoie inchangé — jamais
 * bloquant, n'importe quel angle reste choisissable librement. */
export function snapAngle(angleDeg: number): number {
  const normalized = ((angleDeg % 360) + 360) % 360;
  let best = angleDeg;
  let bestDelta = ANGLE_SNAP_THRESHOLD_DEG;
  for (const candidate of SNAP_ANGLES_DEG) {
    const delta = angleDelta(normalized, candidate);
    if (delta < bestDelta) {
      bestDelta = delta;
      // Corrige par le même écart que la normalisation a introduit, pour
      // ne pas ramener brutalement un angle "370°" à "10°".
      best = angleDeg - (normalized - candidate);
    }
  }
  return best;
}

/** Vrai si `angleDeg` est actuellement accroché à un angle remarquable —
 * sert uniquement au léger feedback visuel (voir RulerOverlay), pas au
 * calcul de rotation lui-même. */
export function isSnappedAngle(angleDeg: number): boolean {
  const normalized = ((angleDeg % 360) + 360) % 360;
  return SNAP_ANGLES_DEG.some((c) => angleDelta(normalized, c) < ANGLE_SNAP_THRESHOLD_DEG);
}

/** Vrai si le point (x, y) tombe sur le corps de la règle — distingue
 * "doigt sur la règle" (déplacer/tourner, voir NotesCanvas.tsx) de "doigt
 * ailleurs" (comportement de navigation habituel, inchangé). */
export function isPointOnRuler(ruler: RulerState, x: number, y: number): boolean {
  const rad = degToRad(ruler.angleDeg);
  const dx = x - ruler.x;
  const dy = y - ruler.y;
  // Repère local de la règle : u = le long de l'axe, v = en épaisseur.
  const u = dx * Math.cos(rad) + dy * Math.sin(rad);
  const v = -dx * Math.sin(rad) + dy * Math.cos(rad);
  return Math.abs(u) <= RULER_LENGTH / 2 && Math.abs(v) <= RULER_THICKNESS / 2;
}

export interface RulerEdge {
  /** Un point quelconque de la droite portée par ce bord. */
  origin: { x: number; y: number };
  /** Vecteur unitaire le long du bord. */
  direction: { x: number; y: number };
}

/** Les deux bords longs de la règle, comme deux droites infinies (pas des
 * segments) — un trait continue d'être guidé même glissé au-delà de la
 * longueur visible de la règle, comme un vrai coup de crayon prolongé
 * après l'extrémité tenue. */
export function rulerEdges(ruler: RulerState): [RulerEdge, RulerEdge] {
  const rad = degToRad(ruler.angleDeg);
  const dir = { x: Math.cos(rad), y: Math.sin(rad) };
  const normal = { x: -Math.sin(rad), y: Math.cos(rad) };
  const half = RULER_THICKNESS / 2;
  return [
    { origin: { x: ruler.x + normal.x * half, y: ruler.y + normal.y * half }, direction: dir },
    { origin: { x: ruler.x - normal.x * half, y: ruler.y - normal.y * half }, direction: dir },
  ];
}

function distanceToLine(edge: RulerEdge, x: number, y: number): number {
  const dx = x - edge.origin.x;
  const dy = y - edge.origin.y;
  // Composante perpendiculaire à `direction` = distance signée à la droite.
  return Math.abs(dx * -edge.direction.y + dy * edge.direction.x);
}

/** Bord le plus proche de (x, y) parmi les deux, avec sa distance — voir
 * `RULER_SNAP_THRESHOLD` pour le seuil d'accroche appliqué par l'appelant. */
export function closestEdge(ruler: RulerState, x: number, y: number): { edge: RulerEdge; distance: number } {
  const [e1, e2] = rulerEdges(ruler);
  const d1 = distanceToLine(e1, x, y);
  const d2 = distanceToLine(e2, x, y);
  return d1 <= d2 ? { edge: e1, distance: d1 } : { edge: e2, distance: d2 };
}

/** Projette (x, y) sur la droite portée par `edge` — c'est ce qui rend un
 * trait parfaitement rectiligne une fois accroché, quel que soit le
 * tremblement réel du geste ; le point projeté est ensuite utilisé comme
 * `x`/`y` normal d'un `StrokePoint`, la pression/inclinaison réelles
 * restant inchangées (voir NotesCanvas.tsx). */
export function projectOntoEdge(edge: RulerEdge, x: number, y: number): { x: number; y: number } {
  const dx = x - edge.origin.x;
  const dy = y - edge.origin.y;
  const t = dx * edge.direction.x + dy * edge.direction.y;
  return { x: edge.origin.x + edge.direction.x * t, y: edge.origin.y + edge.direction.y * t };
}
