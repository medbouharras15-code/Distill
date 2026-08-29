import { Wordmark } from "@/components/Brand";

const CONTACT_EMAIL = "med.bouharras.15@gmail.com";

/** Pied de page minimal — pas de liens vers des pages qui n'existent pas
 * encore (mentions légales, blog…), pour ne jamais créer de lien mort.
 * L'email de contact, lui, doit rester accessible depuis l'accueil sans
 * connexion (contrairement à la FAQ interne, réservée aux comptes connectés)
 * — seul point de contact public du site. */
export function LandingFooter() {
  return (
    <footer className="border-t border-border px-6 py-8 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
        <Wordmark size={20} />
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Distill. Fait pour les étudiants.</p>
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-xs text-muted-foreground transition hover:text-foreground">
          {CONTACT_EMAIL}
        </a>
      </div>
    </footer>
  );
}
