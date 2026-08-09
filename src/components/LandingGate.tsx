import Link from "next/link";
import { FREE_GENERATIONS_LIMIT } from "@/lib/billing";

/** Page d'accueil affichée aux visiteurs non connectés. */
export default function LandingGate() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-accent-dark">
        Distill
      </p>
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
        <Link
          href="/signup"
          className="rounded-xl bg-accent px-8 py-3.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-dark"
        >
          Créer un compte gratuit
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-border bg-card px-8 py-3.5 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent-dark"
        >
          Se connecter
        </Link>
      </div>

      <p className="mt-6 text-xs text-muted">
        {FREE_GENERATIONS_LIMIT} générations gratuites, sans carte bancaire.
      </p>
    </div>
  );
}
