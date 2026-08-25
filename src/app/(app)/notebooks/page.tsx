"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/LibraryScreens";
import { SheetPreview } from "@/components/notes/SheetPreview";
import { Badge, Card, buttonClasses, staggerDelay } from "@/components/ui";
import { mockNotebooks } from "@/lib/appMockData";
import { Books, Dots, Plus, Star } from "@/lib/icons";
import { PAPER_SIZES, SHEET_TYPES } from "@/lib/notes/sheets";

const totalPages = mockNotebooks.reduce((sum, n) => sum + n.pages, 0);
const subjects = Array.from(new Set(mockNotebooks.map((n) => n.subject)));
const filters = ["Tous", "Favoris", ...subjects];

const sheetTypeLabel = (id: (typeof mockNotebooks)[number]["sheetType"]) =>
  SHEET_TYPES.find((s) => s.value === id)?.label ?? id;

export default function NotebooksPage() {
  const [filter, setFilter] = useState("Tous");
  const hasNotebooks = mockNotebooks.length > 0;

  const list = useMemo(() => {
    if (filter === "Tous") return mockNotebooks;
    if (filter === "Favoris") return mockNotebooks.filter((n) => n.favorite);
    return mockNotebooks.filter((n) => n.subject === filter);
  }, [filter]);

  return (
    <div className="mx-auto max-w-[1180px] animate-fade px-6 py-8 md:px-10 md:py-12">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-4xl font-medium tracking-[-0.02em] text-foreground">Mes carnets</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            {hasNotebooks ? `${mockNotebooks.length} carnets · ${totalPages} pages au total` : "Tous tes carnets, au même endroit."}
          </p>
        </div>
        <Link href="/notebooks/new" className={buttonClasses("primary", "md", "gap-2")}>
          <Plus size={18} /> Nouveau carnet
        </Link>
      </header>

      {hasNotebooks && (
        <div className="mt-8 flex flex-wrap items-center gap-2">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
                filter === f ? "bg-foreground text-background" : "border border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {!hasNotebooks ? (
        <EmptyState
          icon={<Books size={28} />}
          title="Pas encore de carnet"
          body="Crée ton premier carnet pour commencer à prendre des notes et les transformer en révisions par l'IA."
          cta={{ label: "Créer un carnet", href: "/notebooks/new" }}
        />
      ) : (
      <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((n, i) => {
          const ratio = PAPER_SIZES.find((p) => p.value === n.paperSize)?.ratio ?? PAPER_SIZES[0].ratio;
          return (
            <Link key={n.id} href="/notes" className="group block animate-fade text-left" style={staggerDelay(i)}>
              <Card className="card-hover relative overflow-hidden">
                {/* Léger bain de couleur au survol, dans la teinte du carnet —
                    donne un sentiment d'identité propre à chaque carnet plutôt
                    qu'une grille uniforme. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: `radial-gradient(140% 70% at 50% 0%, color-mix(in srgb, ${n.color} 16%, transparent), transparent 70%)` }}
                />
                {/* "Plateau" légèrement en retrait (bg-background-alt) dans
                    lequel repose la feuille : l'espace tout autour est ce qui
                    permet à l'ombre propre de la feuille de se voir — collée
                    aux bords de la carte, elle serait invisible (rognée par
                    l'overflow-hidden de la Card). L'ombre est posée ici sur le
                    conteneur qui porte lui-même l'overflow-hidden (pas sur un
                    enfant qu'il rognerait) pour ne jamais être coupée. */}
                <div className="relative z-10 bg-background-alt/70 p-3">
                  <div className="relative h-32 overflow-hidden rounded-xl paper-grain shadow-[0_14px_26px_-12px_rgba(0,0,0,0.4),0_3px_8px_-3px_rgba(0,0,0,0.25)] transition-transform duration-500 group-hover:-translate-y-1">
                    <SheetPreview
                      sheetType={n.sheetType}
                      backgroundColor="#ffffff"
                      ratio={ratio}
                      width={200}
                      className="h-full w-full !rounded-none !border-0 transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    {n.favorite && (
                      <span className="absolute right-2.5 top-2.5 z-[2] text-primary drop-shadow-sm">
                        <Star size={17} />
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative z-10 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="h-2 w-2 rounded-full" style={{ background: n.color }} /> {n.subject}
                      </div>
                      <div className="mt-1 font-medium leading-snug text-foreground">{n.title}</div>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Plus d'actions"
                      className="cursor-pointer text-muted-foreground hover:text-foreground"
                      onClick={(e) => e.preventDefault()}
                    >
                      <Dots size={18} />
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Badge className="bg-secondary text-secondary-foreground">{sheetTypeLabel(n.sheetType)}</Badge>
                    <span>{n.pages} p.</span>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
        <Link href="/notebooks/new" className="group block animate-fade" style={staggerDelay(list.length)}>
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border text-muted-foreground transition-all duration-300 ease-[var(--ease-signature)] hover:border-primary hover:bg-secondary/30 hover:text-primary">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-current transition-transform duration-300 group-hover:scale-110">
              <Plus size={22} />
            </div>
            <span className="text-sm font-medium">Créer un carnet</span>
          </div>
        </Link>
      </div>
      )}
    </div>
  );
}
