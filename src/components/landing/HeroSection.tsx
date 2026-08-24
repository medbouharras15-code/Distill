"use client";

import Link from "next/link";
import { AiOrb } from "@/components/Brand";
import { Badge, buttonClasses } from "@/components/ui";
import { FREE_GENERATIONS_LIMIT } from "@/lib/billing";
import { ChevronRight } from "@/lib/icons";
import { useParallax } from "./useScrollMotion";

const noteLines = [72, 55, 84, 40, 66];

/** Le moment phare du hero : à gauche/en arrière-plan, une note manuscrite
 * brute ; à droite/au premier plan, le résumé + une flashcard qu'elle
 * devient — reliés par l'orbe IA, comme si la distillation se produisait
 * sous les yeux du visiteur. Les deux cartes dérivent à des vitesses de
 * scroll différentes (arrière-plan plus lent, premier plan plus réactif)
 * pour la sensation de profondeur demandée. */
export function HeroSection() {
  const bgOffset = useParallax(0.05);
  const fgOffset = useParallax(0.14);

  return (
    <section className="landing-grain relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 right-[-10%] h-[520px] w-[520px] rounded-full ai-gradient opacity-[0.10] blur-[110px]"
      />
      <div className="relative z-10 mx-auto grid max-w-7xl gap-16 px-6 pb-20 pt-16 sm:px-8 sm:pt-20 lg:grid-cols-2 lg:items-center lg:gap-12 lg:pb-32 lg:pt-24">
        {/* Copy */}
        <div>
          <Badge className="border border-border bg-card text-[11px] font-medium text-muted-foreground">
            <AiOrb size={16} /> Résumés & flashcards par IA
          </Badge>

          <h1 className="mt-7 font-display text-[44px] font-medium leading-[1.02] tracking-[-0.035em] text-foreground sm:text-6xl lg:text-[68px]">
            Vos notes de cours,
            <br />
            <span className="italic text-accent-dark">
              <span className="landing-drop">distillées</span>
            </span>{" "}
            en l&apos;essentiel.
          </h1>

          <p className="mt-6 max-w-[26rem] text-lg leading-relaxed text-muted-foreground">
            Collez du texte, une photo de vos notes manuscrites ou un PDF de cours : Distill génère un résumé
            structuré et des flashcards de révision en quelques secondes.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className={buttonClasses("primary", "lg")}>
              Créer un compte gratuit
            </Link>
            <Link href="/login" className={buttonClasses("outline", "lg")}>
              Se connecter
            </Link>
          </div>

          <p className="mt-5 text-xs text-muted-foreground">
            {FREE_GENERATIONS_LIMIT} générations gratuites, sans carte bancaire.
          </p>
        </div>

        {/* Signature visual — la distillation en direct */}
        <div className="relative h-[420px] sm:h-[460px] lg:h-[500px]" style={{ perspective: 1200 }}>
          {/* Note brute — arrière-plan, dérive lente */}
          <div
            style={{ transform: `translateY(${bgOffset}px) rotate(-5deg)` }}
            className="absolute left-2 top-2 w-[210px] rounded-2xl border border-border bg-card p-5 opacity-90 shadow-[var(--shadow-md)] sm:w-[240px] sm:left-4"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Brouillon</span>
              <Badge className="bg-secondary text-secondary-foreground">PDF</Badge>
            </div>
            <div className="mt-4 space-y-2.5">
              {noteLines.map((w, i) => (
                <div key={i} className="h-2 rounded-full bg-foreground/15" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>

          {/* Orbe IA — le point de distillation */}
          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            <AiOrb size={52} active />
          </div>

          {/* Résultat distillé — premier plan, plus réactif au scroll */}
          <div
            aria-hidden="true"
            style={{
              transform: `translateY(${fgOffset}px)`,
              background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 30%, transparent) 0%, transparent 72%)",
            }}
            className="absolute bottom-0 right-[-20px] h-[220px] w-[220px] rounded-full opacity-40 blur-[60px] sm:right-[-10px]"
          />
          <div
            style={{ transform: `translateY(${fgOffset}px)` }}
            className="absolute bottom-4 right-1 w-[240px] rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-lg)] sm:w-[270px] sm:right-2"
          >
            <div className="flex items-center gap-2">
              <Badge className="bg-accent-light/60 text-accent-dark">Résumé généré</Badge>
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-2.5 w-3/4 rounded-full bg-accent-light" />
              <div className="h-2 w-full rounded-full bg-secondary" />
              <div className="h-2 w-5/6 rounded-full bg-secondary" />
            </div>
            <div className="mt-4 rounded-xl border border-accent-light bg-accent-light/40 p-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent-dark">Flashcard</div>
              <div className="mt-1 text-[13px] leading-snug text-foreground">Quelle enzyme fixe le CO₂ ?</div>
            </div>
          </div>
        </div>
      </div>

      {/* Indice de défilement — discret, respire doucement (voir
          .landing-scroll-hint dans globals.css), signale qu'il y a plus à
          découvrir en dessous sans jamais imiter une flèche criarde. Caché
          sur mobile où l'espace vertical est déjà rare. */}
      <div
        aria-hidden="true"
        className="landing-scroll-hint pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-muted-foreground/60 lg:block"
      >
        <ChevronRight size={18} className="rotate-90" />
      </div>
    </section>
  );
}
