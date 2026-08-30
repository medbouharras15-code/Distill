interface IconProps {
  className?: string;
}

/** Stylo (plume fine) avec une goutte d'encre en accent — tracé plus généreux
 * (empattements arrondis) que l'ancienne version pour porter la nouvelle
 * finition "premium" de la barre d'outils. */
export function PenIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 20.5c.15-1.9.5-3.4 1.5-4.4L15.8 5.8a2.3 2.3 0 0 1 3.25 0l.15.15a2.3 2.3 0 0 1 0 3.25L8.9 19.5c-1 1-2.5 1.35-4.4 1.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.6 7.6 16.4 10.4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="5.6" cy="18.4" r="1.05" fill="currentColor" />
    </svg>
  );
}

/** Stylo bille : corps cylindrique à clip, pointe fine — silhouette
 * distincte du stylo plume (PenIcon) pour rester lisible même en icône
 * de repli, une fois affiché comme bouton principal à part entière. */
export function BallpointPenIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M14.5 3.5 20.5 9.5 10.2 19.8 4.5 20.5l.7-5.7Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12.7 5.3 18.7 11.3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M17 3.9 20.1 7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="5.9" cy="18.1" r="1" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

/** Crayon à papier : corps hexagonal, pointe taillée et gomme en accent —
 * pour distinguer clairement l'outil "Crayon" du feutre/stylo bille. */
export function PencilIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M15.3 3.9 20.1 8.7 9.3 19.5l-5.8 1 1-5.8Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.5 5.7 18.3 10.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M4.5 15.7 8.3 19.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
      <circle cx="5.4" cy="18.6" r="0.95" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

/** Règle graduée simplifiée, avec quelques traits de graduation en accent. */
export function RulerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="m5.6 3.6 14.8 14.8-4.2 4.2L1.4 7.8Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M6.9 4.9 5.3 6.5M9.3 7.3 7 9.6M11.7 9.7l-2.9 2.9M14.1 12.1l-1.6 1.6M16.5 14.5l-2.9 2.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

/** Boucle en pointillés façon lasso, avec un point d'accroche en accent. */
export function LassoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 4.2c4.4 0 7.8 2.6 7.8 6s-3.4 6-7.8 6c-3.3 0-6.1-1.4-7.3-3.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeDasharray="2.6 2.6"
      />
      <path d="M4 12.7 3 17l4.2-1.3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="15.5" cy="8.2" r="1" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

/** Note autocollante avec un coin replié en accent. */
export function NoteIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4.5 4.5h11.4L19.5 8.4V19.5h-15Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M15.9 4.5V8.4h3.6" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" opacity="0.55" />
      <path d="M7.5 11.5h8M7.5 14.8h5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

/** Surligneur à pointe biseautée avec une touche de couleur (le trait de
 * surlignage lui-même, en accent semi-transparent) plutôt qu'un simple
 * soulignement au trait. */
export function HighlighterIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M8 16 15.6 4.7a1.5 1.5 0 0 1 2.2-.35l1.85 1.5a1.5 1.5 0 0 1 .25 2.15L11.2 19.2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M8 16 5.3 18.7l-1.8.8.6-1.9L6.6 14.7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="3" y="20.1" width="7.4" height="2" rx="1" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

/** Gomme arrondie inclinée, avec une petite trace de poussière en accent
 * pour évoquer le geste d'effacement plutôt qu'un simple bloc statique. */
export function EraserIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="m17 3.6 3.4 3.4a1.7 1.7 0 0 1 0 2.4l-8.9 8.9H6.1L2.7 14.9a1.7 1.7 0 0 1 0-2.4L14.6 3.6a1.7 1.7 0 0 1 2.4 0Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M9.9 8.4 15.6 14.1" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M3.6 20.5h9.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="19.3" cy="19.1" r="0.9" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

export function UndoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M7 8H4V5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 8.5A8 8 0 1 1 4 13"
        stroke="currentColor"
        strokeWidth="1.9"
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
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.5 8.5A8 8 0 1 0 20 13"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Cercle et carré superposés, avec un point d'accent au croisement : outil
 * "Formes". */
export function ShapesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.3" stroke="currentColor" strokeWidth="1.75" />
      <rect x="11.2" y="11.2" width="9.3" height="9.3" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="8.5" cy="8.5" r="1.15" fill="currentColor" opacity="0.4" />
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

/** Cadre avec montagne et soleil, plus une petite étincelle d'ajout en coin :
 * outil "Photo" (import d'image). */
export function PhotoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="4.8" width="18" height="14.4" rx="2.4" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="8.6" cy="9.6" r="1.7" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="m4.6 17.2 4.6-4.6 3.4 3.4 4.3-4.3 3.1 3.1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17.3 3.2v2.2M16.2 4.3h2.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
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

/** Main ouverte simplifiée (façon outil "main" de Photoshop), avec deux
 * points de dérive en accent : outil "Déplacement" — fait défiler la feuille
 * sans jamais rien dessiner. */
export function PanIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M9 12.2V5.5a1.3 1.3 0 1 1 2.6 0v5.7M11.6 11V4.3a1.3 1.3 0 1 1 2.6 0V11M14.2 11V5.8a1.3 1.3 0 1 1 2.6 0v7.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12.2 7.1 10.4a1.4 1.4 0 0 0-2.2 1.7l2.9 4.4A6 6 0 0 0 12.8 19h1.2a5.2 5.2 0 0 0 5.2-5.2V9.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="19.9" cy="6.3" r="0.9" fill="currentColor" opacity="0.4" />
      <circle cx="21.7" cy="9.1" r="0.6" fill="currentColor" opacity="0.25" />
    </svg>
  );
}

/** Quatre coins de cadre ("plein écran") : bouton "Ajuster à l'écran" —
 * revient au zoom 100% plein écran, sans marge. */
export function FitScreenIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 9V5.5A1.5 1.5 0 0 0 18.5 4H15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20H9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** "T" moderne (barre horizontale + jambage) avec un point de curseur en
 * accent, pour l'outil texte dans la barre principale. */
export function TextToolIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4.8 6.7h13.4" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M11.5 6.7V18.2" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="17.3" cy="18.2" r="1" fill="currentColor" opacity="0.45" />
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
