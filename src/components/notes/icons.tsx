interface IconProps {
  className?: string;
}

/** Stylo (plume fine), tracé net inspiré des icônes d'édition minimalistes. */
export function PenIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M3.5 20.5 4 17l10.5-10.5a2 2 0 0 1 2.83 0l.67.67a2 2 0 0 1 0 2.83L7.5 20 3.5 20.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13 8l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Surligneur à pointe biseautée, avec un trait souligné pour évoquer l'effet
 * de surlignage. */
export function HighlighterIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M8.5 15.5 15.5 4.9a1.4 1.4 0 0 1 2.15-.28l1.73 1.73a1.4 1.4 0 0 1-.28 2.15L8.5 15.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 15.5 6 18l-2.5.5L4 16l2.5-2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 20.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Gomme classique inclinée, avec le liseré caractéristique près de la pointe. */
export function EraserIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="m17.5 3.5 3 3a1.5 1.5 0 0 1 0 2.12L11.7 17.4H6.4l-3.1-3.1a1.5 1.5 0 0 1 0-2.12l11.9-11.9a1.5 1.5 0 0 1 2.3.12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.8 8.6 14.9 13.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3.5 20.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function UndoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M7 8H4V5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 8.5A8 8 0 1 1 4 13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RedoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M17 8h3V5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.5 8.5A8 8 0 1 0 20 13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Cercle et carré superposés : outil "Formes". */
export function ShapesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="9.5" cy="9.5" r="6" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="11" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function CircleShapeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function RectangleShapeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function TriangleShapeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 4.5 20.5 19.5H3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LineShapeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4.5 19.5 19.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Cadre avec montagne et soleil : outil "Photo" (import d'image). */
export function PhotoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8.5" cy="9.5" r="1.6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m4.5 17 5-5 3.5 3.5L17 11l3 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ZoomInIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M20 20 15.2 15.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10.5 7.5v6M7.5 10.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ZoomOutIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M20 20 15.2 15.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7.5 10.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Main ouverte simplifiée (façon outil "main" de Photoshop) : outil
 * "Déplacement" — fait défiler la feuille sans jamais rien dessiner. */
export function PanIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M9 12.2V5.5a1.3 1.3 0 1 1 2.6 0v5.7M11.6 11V4.3a1.3 1.3 0 1 1 2.6 0V11M14.2 11V5.8a1.3 1.3 0 1 1 2.6 0v7.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12.2 7.1 10.4a1.4 1.4 0 0 0-2.2 1.7l2.9 4.4A6 6 0 0 0 12.8 19h1.2a5.2 5.2 0 0 0 5.2-5.2V9.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Quatre coins de cadre ("plein écran") : bouton "Ajuster à l'écran" —
 * revient au zoom 100% plein écran, sans marge. */
export function FitScreenIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 9V5.5A1.5 1.5 0 0 0 18.5 4H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** "T" moderne, tracé net (barre horizontale + jambage), pour l'outil texte
 * dans la barre principale. */
export function TextToolIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5 6.5h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 6.5V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function BoldIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M7.5 5h5.2a3.3 3.3 0 0 1 0 6.6H7.5V5ZM7.5 11.6h5.8a3.4 3.4 0 0 1 0 6.8H7.5v-6.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ItalicIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M11 5h6M7 19h6M14 5 10 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UnderlineIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M6 4.5v6.5a6 6 0 0 0 12 0V4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.5 19.5h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function StrikethroughIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M7 6.2C7.6 5 9.2 4.2 11.3 4.2c2.6 0 4.5 1.2 4.5 3 0 1.4-1 2.2-2.3 2.7M8.6 15.6c-.3 1.1.5 3 3.4 3 2.4 0 4.3-1 4.6-2.7.2-1-.3-1.8-1.2-2.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function SuperscriptIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M3.5 8.5 10 17M10 8.5l-6.5 8.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14.5 8.5h4.8M17 6.2c1 0 2.3.6 2.3 1.9 0 1.6-2.5 1.9-2.5 3.4h2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SubscriptIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M3.5 7 10 15.5M10 7l-6.5 8.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14.5 15.5h4.8M17 13.2c1 0 2.3.6 2.3 1.9 0 1.6-2.5 1.9-2.5 3.4h2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5.5 9 12 15.5 18.5 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LinkIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M9.5 14.5 14.5 9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M11 6.5 12.4 5a3.5 3.5 0 0 1 5 5L16 11.4M13 17.5 11.6 19a3.5 3.5 0 0 1-5-5L8 12.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChecklistIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3.5" y="4.5" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="m4.7 7 1 1 1.8-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.5 7h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="3.5" y="14.5" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11.5 17h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function BulletListIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="4.5" cy="6.5" r="1.3" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="4.5" cy="17.5" r="1.3" fill="currentColor" />
      <path d="M9 6.5h11M9 12h11M9 17.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function NumberedListIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M9 6.5h11M9 12h11M9 17.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <text x="2" y="8.5" fontSize="6" fill="currentColor" stroke="none" fontFamily="sans-serif">
        1
      </text>
      <text x="2" y="14" fontSize="6" fill="currentColor" stroke="none" fontFamily="sans-serif">
        2
      </text>
      <text x="2" y="19.5" fontSize="6" fill="currentColor" stroke="none" fontFamily="sans-serif">
        3
      </text>
    </svg>
  );
}

export function BlockquoteIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5 5.5v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9.5 8h9.5M9.5 12.2h9.5M9.5 16.4h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CodeBlockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M9 7 4.5 12 9 17M15 7l4.5 5-4.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IndentIncreaseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 5.5h16M4 18.5h16M11 12h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m4 9 3.5 3L4 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IndentDecreaseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 5.5h16M4 18.5h16M11 12h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m7.5 9-3.5 3 3.5 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlignLeftIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 6.5h16M4 11h11M4 15.5h16M4 20h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function AlignCenterIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 6.5h16M6.5 11h11M4 15.5h16M6.5 20h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function AlignRightIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 6.5h16M9 11h11M4 15.5h16M9 20h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function AlignJustifyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 6.5h16M4 11h16M4 15.5h16M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
