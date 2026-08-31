"use client";

import { RULER_LENGTH, RULER_THICKNESS, isSnappedAngle, type RulerState } from "@/lib/notes/ruler";

interface RulerOverlayProps {
  ruler: RulerState;
  pageWidth: number;
  pageHeight: number;
  /** Vrai pendant une rotation à deux doigts active — affiche l'indicateur
   * d'angle temporaire (voir NotesCanvas.tsx). */
  rotating: boolean;
}

/** Grandes graduations ("centimètres" du document) tous les 40 unités
 * logiques, petites ("millimètres") tous les 4 — une unité cohérente du
 * document, pas une mesure physique calibrée (voir plan validé : aucune
 * calibration fiable de l'écran n'existe, on ne prétend pas en fournir une). */
const MAJOR_STEP = 40;
const MINOR_STEP = 4;

/** Rendu purement visuel de la règle — verre fumé semi-transparent avec
 * graduations, positionné/dimensionné en `%` de la page (même repère que
 * TextBoxOverlay) pour hériter automatiquement du zoom global sans aucun
 * calcul manuel. `pointer-events: none` sur tout l'overlay : l'interaction
 * (déplacer/tourner/accrocher un tracé) est entièrement gérée par les
 * gestionnaires de pointeur déjà existants sur le `<canvas>` en dessous
 * (voir NotesCanvas.tsx), pas par des événements DOM propres à ce calque —
 * ça évite de dupliquer la logique de capture/pincement déjà en place. */
export function RulerOverlay({ ruler, pageWidth, pageHeight, rotating }: RulerOverlayProps) {
  const leftPct = (ruler.x / pageWidth) * 100;
  const topPct = (ruler.y / pageHeight) * 100;
  const widthPct = (RULER_LENGTH / pageWidth) * 100;
  const heightPct = (RULER_THICKNESS / pageHeight) * 100;

  const majorTicks: number[] = [];
  for (let u = 0; u <= RULER_LENGTH; u += MAJOR_STEP) majorTicks.push(u);
  const minorTicks: number[] = [];
  for (let u = 0; u <= RULER_LENGTH; u += MINOR_STEP) {
    if (u % MAJOR_STEP !== 0) minorTicks.push(u);
  }

  const snapped = isSnappedAngle(ruler.angleDeg);
  const displayAngle = Math.round(((ruler.angleDeg % 360) + 360) % 360);

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${widthPct}%`,
        height: `${heightPct}%`,
        transform: `translate(-50%, -50%) rotate(${ruler.angleDeg}deg)`,
        filter: "drop-shadow(0 3px 8px rgba(10,20,18,0.22))",
      }}
    >
      <svg viewBox={`0 0 ${RULER_LENGTH} ${RULER_THICKNESS}`} preserveAspectRatio="none" className="block h-full w-full overflow-visible">
        <defs>
          <linearGradient id="ruler-glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="20%" stopColor="rgba(214,238,228,0.22)" />
            <stop offset="100%" stopColor="rgba(24,38,34,0.3)" />
          </linearGradient>
        </defs>
        <rect
          x={1}
          y={1}
          width={RULER_LENGTH - 2}
          height={RULER_THICKNESS - 2}
          rx={12}
          fill="url(#ruler-glass)"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth={1.5}
        />
        {minorTicks.map((u) => (
          <line
            key={`mn-${u}`}
            x1={u}
            y1={RULER_THICKNESS * 0.6}
            x2={u}
            y2={RULER_THICKNESS - 7}
            stroke="rgba(18,36,32,0.55)"
            strokeWidth={1}
          />
        ))}
        {majorTicks.map((u) => (
          <line
            key={`mj-${u}`}
            x1={u}
            y1={RULER_THICKNESS * 0.3}
            x2={u}
            y2={RULER_THICKNESS - 7}
            stroke="rgba(14,30,26,0.8)"
            strokeWidth={1.6}
          />
        ))}
        {majorTicks.slice(0, -1).map((u, i) => (
          <text key={`lb-${u}`} x={u + 4} y={RULER_THICKNESS * 0.3 - 5} fontSize={13} fill="rgba(14,30,26,0.8)" fontFamily="ui-sans-serif, system-ui">
            {i}
          </text>
        ))}
      </svg>
      {rotating && (
        <div
          className={`absolute left-1/2 top-1/2 rounded-full px-2.5 py-1 text-xs font-semibold text-white shadow-md transition-colors duration-150 ${
            snapped ? "bg-accent" : "bg-black/70"
          }`}
          style={{ transform: `translate(-50%, -50%) rotate(${-ruler.angleDeg}deg)` }}
        >
          {displayAngle}°
        </div>
      )}
    </div>
  );
}
