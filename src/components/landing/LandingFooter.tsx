import Link from "next/link";
import { Wordmark } from "@/components/Brand";

const CONTACT_EMAIL = "med.bouharras.15@gmail.com";

const LEGAL_LINKS = [
  { href: "/terms", label: "CGU" },
  { href: "/privacy-policy", label: "Confidentialité" },
  { href: "/refund-policy", label: "Remboursement" },
];

/** Pied de page — l'email de contact et les 3 pages légales doivent rester
 * accessibles depuis l'accueil sans connexion (contrairement à la FAQ
 * interne, réservée aux comptes connectés) : exigence de Paddle avant
 * l'approbation du domaine, et bonne pratique indépendamment de ça. */
export function LandingFooter() {
  return (
    <footer className="border-t border-border px-6 py-8 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
        <Wordmark size={20} />
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Distill. Fait pour les étudiants.</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-muted-foreground transition hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-xs text-muted-foreground transition hover:text-foreground">
            {CONTACT_EMAIL}
          </a>
        </nav>
      </div>
    </footer>
  );
}
