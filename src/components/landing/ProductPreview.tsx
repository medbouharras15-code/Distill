"use client";

import { useState } from "react";
import { AiOrb } from "@/components/Brand";
import { Badge, Eyebrow } from "@/components/ui";
import { Reveal } from "./Reveal";

type Tab = "summary" | "flashcards" | "editor";

const tabs: { id: Tab; label: string }[] = [
  { id: "summary", label: "Résumé" },
  { id: "flashcards", label: "Flashcards" },
  { id: "editor", label: "Éditeur de notes" },
];

const flashcards = [
  { q: "Où se déroule le cycle de Calvin ?", a: "Dans le stroma du chloroplaste." },
  { q: "Quelle enzyme fixe le CO₂ ?", a: "La RuBisCO." },
];

export function ProductPreview() {
  const [tab, setTab] = useState<Tab>("summary");
  const activeIndex = tabs.findIndex((t) => t.id === tab);

  return (
    <section className="mx-auto max-w-7xl px-6 py-20 sm:px-8 sm:py-28">
      <Reveal className="mx-auto max-w-xl text-center">
        <Eyebrow>Aperçu</Eyebrow>
        <h2 className="mt-4 font-display text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-4xl">
          Un outil qui s&apos;intègre à votre façon de travailler.
        </h2>
      </Reveal>

      <Reveal delayMs={100} className="mt-12">
        {/* Sélecteur en pilule glissante — mêmes proportions (largeur de
            bouton fixe et identique, sans espace entre eux) que le toggle
            déjà utilisé dans le panneau IA, pour que l'indicateur glisse
            exactement à la bonne position sans calcul de pixels fragile. */}
        <div className="relative mx-auto flex w-fit rounded-full border border-border bg-card p-1 shadow-[var(--shadow-sm)]">
          <span
            aria-hidden="true"
            className="absolute inset-y-1 rounded-full bg-secondary shadow-[var(--shadow-sm)] transition-transform duration-300"
            style={{
              width: "calc((100% - 8px) / 3)",
              left: 4,
              transform: `translateX(calc(${activeIndex} * 100%))`,
              transitionTimingFunction: "var(--ease-signature)",
            }}
          />
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative z-10 w-28 shrink-0 rounded-full px-3 py-2 text-center text-[13px] font-medium transition-colors duration-200 sm:w-32 ${
                tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative mx-auto mt-8 max-w-3xl overflow-hidden rounded-[calc(var(--radius)+6px)] border border-border bg-card shadow-[var(--shadow-lg)]">
          {/* Halo décoratif, clipsé par overflow-hidden du conteneur — même
              technique que le Hero/CTA final (color-mix sur --accent),
              plutôt qu'une nouvelle couleur. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-40 blur-[90px]"
            style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 22%, transparent) 0%, transparent 70%)" }}
          />

          {/* Chrome de fenêtre persistant — identique sur les 3 onglets,
              pour que basculer d'un onglet à l'autre se lise comme naviguer
              dans une seule fenêtre plutôt que changer de carte. */}
          <div className="relative flex items-center gap-2 border-b border-border bg-background-alt/60 px-5 py-3.5">
            {["#0f7a63", "#3b6ee0", "#c9436f"].map((c) => (
              <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} aria-hidden="true" />
            ))}
            <span className="ml-2 font-mono text-[11px] text-muted-foreground/70">distill.app</span>
          </div>

          <div className="relative min-h-[320px] p-6 sm:p-10">
            {tab === "summary" && (
              <div className="animate-fade">
                <Badge className="bg-accent-light/60 text-accent-dark">Résumé · en 5 s</Badge>
                <h3 className="mt-4 font-display text-xl font-medium text-foreground">Photosynthèse — l&apos;essentiel</h3>
                <ul className="mt-4 space-y-3">
                  {[
                    "La photosynthèse convertit l'énergie lumineuse en énergie chimique.",
                    "Le cycle de Calvin fixe le CO₂ dans le stroma grâce à la RuBisCO.",
                    "Il aboutit à la synthèse de glucides sans lumière directe.",
                  ].map((line) => (
                    <li key={line} className="flex gap-3 text-[15px] leading-relaxed text-foreground/90">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tab === "flashcards" && (
              <div className="grid animate-fade gap-4 sm:grid-cols-2">
                {flashcards.map((c) => (
                  <div key={c.q} className="rounded-2xl border border-border bg-background-alt p-5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent-dark">Question</span>
                    <p className="mt-2 font-display text-[15px] leading-snug text-foreground">{c.q}</p>
                    <div className="mt-4 rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">{c.a}</div>
                  </div>
                ))}
              </div>
            )}

            {tab === "editor" && (
              <div className="animate-fade">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AiOrb size={16} /> Panneau IA intégré
                </span>
                <div
                  className="mt-5 rounded-xl border border-border p-6"
                  style={{
                    background:
                      "repeating-linear-gradient(var(--card), var(--card) 27px, var(--border) 28px)",
                  }}
                >
                  <div className="h-2 w-2/3 rounded-full bg-foreground/20" />
                  <div className="mt-[26px] h-2 w-1/2 rounded-full bg-foreground/20" />
                  <div className="mt-[26px] h-2 w-3/5 rounded-full bg-foreground/20" />
                </div>
              </div>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
