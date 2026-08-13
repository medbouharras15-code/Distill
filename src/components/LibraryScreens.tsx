import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui";

/** En-tête partagé des écrans "Library" (Favoris, Historique, Rechercher) —
 * même structure que le Figma Make (fonction `Wrap` de Library.tsx). */
export function ScreenHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header>
      <h1 className="font-display text-4xl font-medium tracking-[-0.02em] text-foreground">{title}</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">{subtitle}</p>
    </header>
  );
}

/** État vide partagé (pas de favoris, pas de résultat…), avec action
 * optionnelle vers un autre écran. */
export function EmptyState({
  icon,
  title,
  body,
  cta,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-secondary text-muted-foreground/60">
        {icon}
      </div>
      <div>
        <div className="font-display text-xl font-medium tracking-tight text-foreground">{title}</div>
        <div className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">{body}</div>
      </div>
      {cta && (
        <Link href={cta.href} className={buttonClasses("outline", "sm")}>
          {cta.label}
        </Link>
      )}
    </div>
  );
}
