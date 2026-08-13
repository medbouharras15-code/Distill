import Link from "next/link";
import { Wordmark } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";

/** En-tête minimal partagé par les pages hors application (landing,
 * connexion, inscription) — logo cliquable + bascule de thème, cohérent
 * avec le reste du nouveau design. */
export function SiteHeader() {
  return (
    <header className="flex items-center justify-between px-4 py-5 sm:px-6">
      <Link href="/" aria-label="Retour à l'accueil Distill">
        <Wordmark size={22} />
      </Link>
      <ThemeToggle />
    </header>
  );
}
