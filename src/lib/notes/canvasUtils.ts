import type { Stroke, StrokePoint } from "./types";

/** Opacité du surligneur : suffisamment transparent pour rester lisible en
 * superposition, combiné à un mélange "multiply" pour l'effet d'encre qui
 * s'accumule là où les traits se croisent (comme un vrai surligneur). */
const HIGHLIGHTER_ALPHA = 0.38;

/** Épaisseur effective d'un point de trait : les feutres fins, stylos bille
 * et le surligneur gardent une épaisseur constante, seul le feutre pinceau
 * réagit à la pression (comme un vrai pinceau). */
export function effectiveWidth(stroke: Pick<Stroke, "tool" | "penType" | "size">, pressure: number): number {
  if (stroke.tool !== "pen" || stroke.penType !== "brush") return stroke.size;
  const factor = 0.5 + pressure * 1.1;
  return stroke.size * factor;
}

/** Dessine un trait lissé (courbes quadratiques entre points médians), avec
 * épaisseur variable point à point pour le feutre pinceau, et un rendu
 * semi-transparent en mode "multiply" pour le surligneur. */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const { points } = stroke;
  if (points.length === 0) return;

  const isHighlighter = stroke.tool === "highlighter";
  const isBrush = stroke.tool === "pen" && stroke.penType === "brush";

  ctx.save();
  if (isHighlighter) {
    ctx.globalAlpha = HIGHLIGHTER_ALPHA;
    ctx.globalCompositeOperation = "multiply";
  }
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (points.length === 1) {
    const p = points[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, effectiveWidth(stroke, p.pressure) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (!isBrush) {
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const mid = midpoint(points[i], points[i + 1]);
      ctx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Feutre pinceau : on trace chaque segment séparément pour faire varier
  // l'épaisseur avec la pression.
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    ctx.lineWidth = effectiveWidth(stroke, (a.pressure + b.pressure) / 2);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function midpoint(a: StrokePoint, b: StrokePoint) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Vrai si le point (x, y) passe à moins de `radius` d'au moins un segment du trait. */
export function strokeHitTest(stroke: Stroke, x: number, y: number, radius: number): boolean {
  const { points } = stroke;
  const pad = radius + stroke.size / 2;
  if (points.length === 1) {
    return distance(points[0], { x, y }) <= pad;
  }
  for (let i = 1; i < points.length; i++) {
    if (distanceToSegment(points[i - 1], points[i], x, y) <= pad) return true;
  }
  return false;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(a: StrokePoint, b: StrokePoint, x: number, y: number): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return distance(a, { x, y });
  let t = ((x - a.x) * dx + (y - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(x - projX, y - projY);
}
