import type { SVGProps } from "react";

/** Jeu d'icônes générique (navigation, actions, statuts) du nouveau design —
 * pendant, pour les écrans applicatifs, du set dédié à l'éditeur de notes
 * (@/components/notes/icons). Trait fin cohérent avec la marque Distill
 * (@/components/Brand), qui reste la seule source pour le symbole IA. */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export const Sparkle = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3l1.6 5.2a3 3 0 0 0 2.2 2.2L21 12l-5.2 1.6a3 3 0 0 0-2.2 2.2L12 21l-1.6-5.2a3 3 0 0 0-2.2-2.2L3 12l5.2-1.6a3 3 0 0 0 2.2-2.2L12 3Z" />
  </Base>
);
export const Home = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 10.5 12 4l8 6.5" />
    <path d="M6 9.5V20h12V9.5" />
    <path d="M10 20v-5h4v5" />
  </Base>
);
export const Books = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 4h5a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5V4Z" />
    <path d="M19 4h-5a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h5V4Z" />
  </Base>
);
export const Clock = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Base>
);
export const Star = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4l2.3 4.7 5.2.8-3.8 3.7.9 5.2L12 16.7 7.4 18.4l.9-5.2L4.5 9.5l5.2-.8L12 4Z" />
  </Base>
);
export const Search = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-3.6-3.6" />
  </Base>
);
export const Gear = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.5M12 18.5V21M4.5 12H3M21 12h-1.5M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" />
  </Base>
);
export const Plus = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);
export const Pen = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20l1-4L16 5l3 3L8 19l-4 1Z" />
    <path d="M14 7l3 3" />
  </Base>
);
export const Check = (p: IconProps) => (
  <Base {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Base>
);
export const ChevronRight = (p: IconProps) => (
  <Base {...p}>
    <path d="m9 6 6 6-6 6" />
  </Base>
);
export const ChevronLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="m15 6-6 6 6 6" />
  </Base>
);
export const Close = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);
export const Dots = (p: IconProps) => (
  <Base {...p}>
    <circle cx="5" cy="12" r="1.3" />
    <circle cx="12" cy="12" r="1.3" />
    <circle cx="19" cy="12" r="1.3" />
  </Base>
);
export const Cards = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="7" width="13" height="12" rx="2" />
    <path d="M8 4h9a2 2 0 0 1 2 2v9" />
  </Base>
);
export const Quiz = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.7.3-1.2.8-1.2 1.6" />
    <path d="M11.5 16.5h.01" />
  </Base>
);
export const Doc = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 3h8l4 4v14H6V3Z" />
    <path d="M14 3v4h4" />
    <path d="M9 12h6M9 15.5h6" />
  </Base>
);
export const Grid = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.4" />
    <rect x="13" y="4" width="7" height="7" rx="1.4" />
    <rect x="4" y="13" width="7" height="7" rx="1.4" />
    <rect x="13" y="13" width="7" height="7" rx="1.4" />
  </Base>
);
export const Bell = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2H4.5L6 16Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Base>
);
export const Menu = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);
export const Crown = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 8l3.5 3L12 5l4.5 6L20 8l-1.5 10h-13L4 8Z" />
    <path d="M5.5 18h13" />
  </Base>
);
export const Lock = (p: IconProps) => (
  <Base {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    <path d="M12 15v2" />
  </Base>
);
export const Cloud = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 18a4 4 0 0 1-.5-7.97A5 5 0 0 1 16 9.5a3.5 3.5 0 0 1 .5 6.96" />
    <path d="M7 18h9.5" />
  </Base>
);
export const Users = (p: IconProps) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.5a3 3 0 0 1 0 5.5M15.5 13.2A5.5 5.5 0 0 1 20.5 19" />
  </Base>
);
