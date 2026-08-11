import type { SheetType, Stroke, StrokePoint } from "./types";

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

// ---------------------------------------------------------------------------
// Motifs de feuille (réglures, quadrillages, gabarits...)
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const value = parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Couleur des lignes de réglure : un bleu-gris discret sur fond clair, une
 * touche de blanc translucide sur fond sombre (mode nuit), pour rester
 * lisible sans jamais rivaliser avec l'encre. */
function guideColor(backgroundColor: string): string {
  return relativeLuminance(backgroundColor) > 0.45
    ? "rgba(70, 92, 132, 0.32)"
    : "rgba(255, 255, 255, 0.22)";
}

/** Couleur d'accent pour la marge (College Rule) : le rose/rouge discret des
 * cahiers à spirale classiques. */
function marginGuideColor(backgroundColor: string): string {
  return relativeLuminance(backgroundColor) > 0.45
    ? "rgba(178, 84, 84, 0.4)"
    : "rgba(255, 150, 150, 0.35)";
}

function drawHorizontalLines(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  spacing: number,
  xStart = width * 0.08,
  xEnd = width * 0.92,
  yStart = height * 0.09,
  yEnd = height * 0.95,
) {
  ctx.beginPath();
  for (let y = yStart; y < yEnd; y += spacing) {
    ctx.moveTo(xStart, y);
    ctx.lineTo(xEnd, y);
  }
  ctx.stroke();
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, spacing: number) {
  ctx.beginPath();
  for (let x = spacing; x < width; x += spacing) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = spacing; y < height; y += spacing) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
}

function drawDots(ctx: CanvasRenderingContext2D, width: number, height: number, spacing: number, color: string) {
  ctx.fillStyle = color;
  const r = Math.max(1, spacing * 0.05);
  for (let x = spacing; x < width; x += spacing) {
    for (let y = spacing; y < height; y += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCornell(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const cueX = width * 0.28;
  const marginX = width * 0.06;
  const summaryY = height * 0.82;
  const topY = height * 0.06;

  ctx.beginPath();
  ctx.moveTo(cueX, topY);
  ctx.lineTo(cueX, summaryY);
  ctx.moveTo(marginX, summaryY);
  ctx.lineTo(width - marginX, summaryY);
  ctx.stroke();

  drawHorizontalLines(ctx, width, height, height / 42, cueX + width * 0.03, width - marginX, topY + height * 0.03, summaryY);
}

function drawCollegeRule(ctx: CanvasRenderingContext2D, width: number, height: number, marginColor: string) {
  drawHorizontalLines(ctx, width, height, height / 40);
  const marginX = width * 0.16;
  ctx.save();
  ctx.strokeStyle = marginColor;
  ctx.beginPath();
  ctx.moveTo(marginX, height * 0.05);
  ctx.lineTo(marginX, height * 0.95);
  ctx.stroke();
  ctx.restore();
}

function drawManuscript(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const marginX = width * 0.08;
  const xEnd = width - marginX;
  const groupSpacing = height / 15;
  let y = height * 0.1;

  while (y < height - height * 0.05) {
    ctx.beginPath();
    ctx.moveTo(marginX, y);
    ctx.lineTo(xEnd, y);
    ctx.moveTo(marginX, y + groupSpacing * 0.55);
    ctx.lineTo(xEnd, y + groupSpacing * 0.55);
    ctx.stroke();

    ctx.save();
    ctx.setLineDash([width * 0.012, width * 0.012]);
    ctx.beginPath();
    ctx.moveTo(marginX, y + groupSpacing * 0.275);
    ctx.lineTo(xEnd, y + groupSpacing * 0.275);
    ctx.stroke();
    ctx.restore();

    y += groupSpacing;
  }
}

function drawColumns(ctx: CanvasRenderingContext2D, width: number, height: number, count: number) {
  const marginY = height * 0.05;
  ctx.beginPath();
  for (let i = 1; i < count; i++) {
    const x = (width / count) * i;
    ctx.moveTo(x, marginY);
    ctx.lineTo(x, height - marginY);
  }
  ctx.stroke();
}

function drawTable(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const cols = 5;
  const rows = 9;
  const marginX = width * 0.05;
  const marginY = height * 0.04;
  const w = width - marginX * 2;
  const h = height - marginY * 2;

  ctx.beginPath();
  for (let i = 0; i <= cols; i++) {
    const x = marginX + (w / cols) * i;
    ctx.moveTo(x, marginY);
    ctx.lineTo(x, marginY + h);
  }
  for (let i = 0; i <= rows; i++) {
    const y = marginY + (h / rows) * i;
    ctx.moveTo(marginX, y);
    ctx.lineTo(marginX + w, y);
  }
  ctx.stroke();
}

function drawIsometric(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const spacing = width / 18;
  const slope = Math.tan(Math.PI / 6); // 30°
  const reach = height / slope;

  ctx.beginPath();
  for (let x = 0; x <= width; x += spacing) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let x = -reach; x <= width; x += spacing) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + reach, height);
  }
  for (let x = 0; x <= width + reach; x += spacing) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x - reach, height);
  }
  ctx.stroke();
}

function drawMusic(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const marginX = width * 0.08;
  const xEnd = width - marginX;
  const staffHeight = height * 0.05;
  const staffGap = height * 0.1;
  let y = height * 0.1;

  while (y + staffHeight < height - height * 0.05) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const ly = y + (staffHeight / 4) * i;
      ctx.moveTo(marginX, ly);
      ctx.lineTo(xEnd, ly);
    }
    ctx.stroke();
    y += staffGap;
  }
}

function drawChecklist(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const marginX = width * 0.1;
  const boxSize = width * 0.025;
  const spacing = height / 20;

  ctx.beginPath();
  for (let y = height * 0.09; y < height - height * 0.05; y += spacing) {
    ctx.rect(marginX, y - boxSize / 2, boxSize, boxSize);
    ctx.moveTo(marginX + boxSize * 1.8, y);
    ctx.lineTo(width - marginX * 0.6, y);
  }
  ctx.stroke();
}

function drawStoryboard(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const cols = 2;
  const rows = 3;
  const marginX = width * 0.08;
  const marginY = height * 0.05;
  const gapX = width * 0.06;
  const gapY = height * 0.045;
  const cellW = (width - marginX * 2 - gapX * (cols - 1)) / cols;
  const cellTotalH = (height - marginY * 2 - gapY * (rows - 1)) / rows;
  const frameH = cellTotalH * 0.7;
  const noteH = cellTotalH * 0.3;

  ctx.beginPath();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = marginX + c * (cellW + gapX);
      const y = marginY + r * (cellTotalH + gapY);
      ctx.rect(x, y, cellW, frameH);
      ctx.moveTo(x, y + frameH + noteH * 0.5);
      ctx.lineTo(x + cellW, y + frameH + noteH * 0.5);
    }
  }
  ctx.stroke();
}

/** Dessine le motif de la feuille (réglure, quadrillage, gabarit...) sur le
 * fond déjà rempli, avant les traits de l'utilisateur. */
export function drawSheetPattern(
  ctx: CanvasRenderingContext2D,
  sheetType: SheetType,
  width: number,
  height: number,
  backgroundColor: string,
) {
  const guide = guideColor(backgroundColor);

  ctx.save();
  ctx.lineWidth = Math.max(1, width / 850);
  ctx.strokeStyle = guide;

  switch (sheetType) {
    case "plain":
      break;
    case "lined-thin":
      drawHorizontalLines(ctx, width, height, height / 44);
      break;
    case "lined-wide":
      drawHorizontalLines(ctx, width, height, height / 28);
      break;
    case "grid-small":
      drawGrid(ctx, width, height, width / 34);
      break;
    case "grid-large":
      drawGrid(ctx, width, height, width / 17);
      break;
    case "dot":
      drawDots(ctx, width, height, width / 34, guide);
      break;
    case "cornell":
      drawCornell(ctx, width, height);
      break;
    case "college-rule":
      drawCollegeRule(ctx, width, height, marginGuideColor(backgroundColor));
      break;
    case "manuscript":
      drawManuscript(ctx, width, height);
      break;
    case "columns-2":
      drawColumns(ctx, width, height, 2);
      break;
    case "columns-3":
      drawColumns(ctx, width, height, 3);
      break;
    case "table":
      drawTable(ctx, width, height);
      break;
    case "isometric":
      drawIsometric(ctx, width, height);
      break;
    case "music":
      drawMusic(ctx, width, height);
      break;
    case "checklist":
      drawChecklist(ctx, width, height);
      break;
    case "storyboard":
      drawStoryboard(ctx, width, height);
      break;
  }

  ctx.restore();
}
