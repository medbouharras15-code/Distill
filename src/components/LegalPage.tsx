import type { ReactNode } from "react";
import { BackLink } from "@/components/ui";

/** Mise en page commune aux 3 pages légales (/terms, /privacy-policy,
 * /refund-policy) — évite de répéter trois fois le même en-tête. Accessible
 * sans connexion (voir chaque page), avec un lien de retour vers l'accueil
 * plutôt que vers /dashboard (pertinent aussi bien pour un visiteur non
 * connecté que pour un utilisateur déjà inscrit). */
export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[720px] animate-fade px-6 py-8 md:px-10 md:py-12">
      <BackLink href="/" className="mb-8">
        Accueil
      </BackLink>

      <h1 className="font-display text-4xl font-medium tracking-[-0.02em] text-foreground">{title}</h1>
      <p className="mt-2 text-[13px] text-muted-foreground">Dernière mise à jour : {lastUpdated}</p>

      <div className="mt-8 space-y-6">{children}</div>
    </div>
  );
}

/** Titre de section (h2) — même style sur les 3 pages. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-medium text-foreground">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

/** Lien inline (vers une autre page légale, ou mailto) — même style sur les
 * 3 pages. */
export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-accent-dark underline underline-offset-2 hover:no-underline">
      {children}
    </a>
  );
}
