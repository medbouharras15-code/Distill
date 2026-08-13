import Link from "next/link";
import { FREE_GENERATIONS_LIMIT } from "@/lib/billing";
import { SiteHeader } from "@/components/SiteHeader";
import { buttonClasses } from "@/components/ui";

/** Page d'accueil affichée aux visiteurs non connectés. */
export default function LandingGate() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center animate-fade">
        <h1 className="font-display text-4xl leading-tight text-foreground sm:text-5xl">
          Vos notes de cours,
          <br />
          <span className="italic text-accent-dark">distillées</span> en
          l&apos;essentiel.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base text-muted">
          Collez du texte, une photo de vos notes manuscrites ou un PDF de
          cours : Distill génère un résumé structuré et des flashcards de
          révision en quelques secondes.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/signup" className={buttonClasses("primary", "lg")}>
            Créer un compte gratuit
          </Link>
          <Link href="/login" className={buttonClasses("outline", "lg")}>
            Se connecter
          </Link>
        </div>

        <p className="mt-6 text-xs text-muted">
          {FREE_GENERATIONS_LIMIT} générations gratuites, sans carte bancaire.
        </p>
      </div>
    </div>
  );
}
