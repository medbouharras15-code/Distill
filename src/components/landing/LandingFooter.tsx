import { Wordmark } from "@/components/Brand";

/** Pied de page minimal — pas de liens vers des pages qui n'existent pas
 * encore (mentions légales, blog…), pour ne jamais créer de lien mort. */
export function LandingFooter() {
  return (
    <footer className="border-t border-border px-6 py-8 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
        <Wordmark size={20} />
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Distill. Fait pour les étudiants.</p>
      </div>
    </footer>
  );
}
