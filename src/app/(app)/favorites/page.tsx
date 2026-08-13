"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState, ScreenHeader } from "@/components/LibraryScreens";
import { SheetPreview } from "@/components/notes/SheetPreview";
import { Badge, Card } from "@/components/ui";
import { mockFavoritePages, mockNotebooks } from "@/lib/appMockData";
import { Search, Star } from "@/lib/icons";
import { PAPER_SIZES } from "@/lib/notes/sheets";

const favoriteNotebooks = mockNotebooks.filter((n) => n.favorite);

export default function FavoritesPage() {
  const [tab, setTab] = useState<"carnets" | "pages">("carnets");
  const [query, setQuery] = useState("");

  const filteredNotebooks = useMemo(
    () => favoriteNotebooks.filter((n) => !query || n.title.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const filteredPages = useMemo(
    () => mockFavoritePages.filter((p) => !query || p.title.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  return (
    <div className="mx-auto max-w-[1000px] animate-fade px-6 py-8 md:px-10 md:py-12">
      <ScreenHeader title="Favoris" subtitle="Tes carnets et pages épinglés pour un accès rapide." />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex rounded-xl border border-border bg-card p-1">
          {(["carnets", "pages"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-[13px] font-medium capitalize transition ${
                tab === t ? "bg-secondary text-foreground shadow-[var(--shadow-sm)]" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "carnets" ? `Carnets (${favoriteNotebooks.length})` : `Pages (${mockFavoritePages.length})`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher…"
            className="w-36 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {tab === "carnets" &&
        (favoriteNotebooks.length === 0 ? (
          <EmptyState
            icon={<Star size={28} />}
            title="Pas encore de favoris"
            body="Épingle tes carnets les plus importants pour les retrouver ici."
            cta={{ label: "Voir mes carnets", href: "/notebooks" }}
          />
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {filteredNotebooks.map((n) => {
              const ratio = PAPER_SIZES.find((p) => p.value === n.paperSize)?.ratio ?? PAPER_SIZES[0].ratio;
              return (
                <Link key={n.id} href="/notes" className="group text-left">
                  <Card className="overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-md)]">
                    <div className="relative h-36 overflow-hidden">
                      <SheetPreview sheetType={n.sheetType} backgroundColor="#ffffff" ratio={ratio} width={200} className="h-full w-full" />
                      <span className="absolute right-2.5 top-2.5 text-[#f59e0b]">
                        <Star size={17} className="fill-current" />
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="h-2 w-2 rounded-full" style={{ background: n.color }} /> {n.subject}
                      </div>
                      <div className="mt-1 font-medium leading-snug text-foreground">{n.title}</div>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Badge className="bg-secondary text-secondary-foreground">{n.pages} p.</Badge>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        ))}

      {tab === "pages" &&
        (mockFavoritePages.length === 0 ? (
          <EmptyState
            icon={<Star size={28} />}
            title="Aucune page favorite"
            body="Épingle des pages depuis l'éditeur pour les retrouver ici."
            cta={{ label: "Ouvrir l'éditeur", href: "/notes" }}
          />
        ) : (
          <div className="mt-6 space-y-3">
            {filteredPages.map((p) => (
              <Link key={p.id} href="/notes" className="group block w-full text-left">
                <Card className="flex items-center gap-4 p-4 transition group-hover:border-primary/40 group-hover:shadow-[var(--shadow-md)]">
                  <div className="h-14 w-11 shrink-0 overflow-hidden rounded-lg border border-border">
                    <SheetPreview sheetType={p.sheetType} backgroundColor="#ffffff" ratio={PAPER_SIZES[0].ratio} width={44} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{p.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {p.notebook} · {p.page}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-[#f59e0b]">
                      <Star size={15} className="fill-current" />
                    </span>
                    <span className="text-[11px] text-muted-foreground">{p.updated}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ))}
    </div>
  );
}
