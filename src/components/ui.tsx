import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "ghost" | "outline" | "soft";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:opacity-40 disabled:pointer-events-none select-none";
const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-[var(--primary-foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.12),0_8px_20px_-10px_var(--accent)] hover:brightness-110 hover:-translate-y-px",
  ghost: "text-foreground/70 hover:text-foreground hover:bg-secondary",
  outline: "border border-border bg-card text-foreground hover:bg-secondary hover:border-muted-foreground/30",
  soft: "bg-accent-light text-accent-dark hover:brightness-97",
};
const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-[15px] rounded-2xl",
  icon: "h-11 w-11",
};

/** Classes du bouton partagé, réutilisables sur un élément non-`<button>`
 * (ex. `next/link` pour une vraie navigation) afin de garder un seul style
 * de référence sans dupliquer les classes à la main. */
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className = "") {
  return `${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`;
}

/** Bouton partagé du nouveau système de design Distill — pilules arrondies,
 * micro-interaction au clic/survol, cohérent sur tout le site. */
export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button className={buttonClasses(variant, size, className)} {...props}>
      {children}
    </button>
  );
}

/** Carte partagée — coins arrondis prononcés, bordure discrète, ombre douce. */
export function Card({ children, className = "", ...props }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[calc(var(--radius)+6px)] border border-border bg-card shadow-[var(--shadow-sm)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/** Étiquette courte (statut, catégorie, compteur…). */
export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${className}`}>
      {children}
    </span>
  );
}

/** Petit libellé mono/majuscules au-dessus d'un titre (ex. "Étape 1 · 2"). */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{children}</div>;
}
