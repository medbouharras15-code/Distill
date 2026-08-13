"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState, ScreenHeader } from "@/components/LibraryScreens";
import { SheetPreview } from "@/components/notes/SheetPreview";
import { Badge, Card, Eyebrow } from "@/components/ui";
import { type MockSearchResult, mockSearchResults, searchSuggestions } from "@/lib/appMockData";
import { Books, ChevronRight, Clock, Close, Pen, Search, Sparkle } from "@/lib/icons";
import { PAPER_SIZES } from "@/lib/notes/sheets";

const filters = ["Tout", "Carnets", "Pages", "Notes manuscrites", "Actions IA"];
const ratio = PAPER_SIZES[0].ratio;

const tips = [
  { icon: Pen, title: "Notes manuscrites", desc: "L'OCR analyse ton écriture pour trouver des mots précis." },
  { icon: Books, title: "Carnets complets", desc: "Cherche par matière, titre ou type de feuille." },
  { icon: Sparkle, title: "Contenu IA", desc: "Retrouve tes résumés, flashcards et fiches générés." },
];

function matchLabel(type: MockSearchResult["type"]) {
  if (type === "notebook") return "Carnet";
  if (type === "ai") return "IA Distill";
  return "Manuscrit";
}

function ResultSection({ label, badge, items }: { label: string; badge?: string; items: MockSearchResult[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <Eyebrow>{label}</Eyebrow>
        {badge && <Badge className="bg-accent text-accent-foreground">{badge}</Badge>}
      </div>
      <div className="space-y-2">
        {items.map((r) => (
          <Link key={r.id} href="/notes" className="group block w-full text-left">
            <Card className="flex items-center gap-4 p-4 transition group-hover:border-primary/40 group-hover:shadow-[var(--shadow-md)]">
              <div className="h-14 w-11 shrink-0 overflow-hidden rounded-lg border border-border">
                <SheetPreview sheetType={r.sheetType} backgroundColor="#ffffff" ratio={ratio} width={44} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{r.excerpt}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {r.notebook}
                  {r.page ? ` · ${r.page}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge className={r.type === "ai" ? "ai-text bg-transparent px-0" : "bg-secondary text-secondary-foreground"}>
                  {matchLabel(r.type)}
                </Badge>
                <ChevronRight size={16} className="text-muted-foreground" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Tout");
  const hasQuery = query.length > 0;

  const results = useMemo(() => {
    if (!hasQuery) return [];
    const q = query.toLowerCase();
    return mockSearchResults.filter((r) => r.excerpt.toLowerCase().includes(q) || r.notebook.toLowerCase().includes(q));
  }, [hasQuery, query]);

  return (
    <div className="mx-auto max-w-[1000px] animate-fade px-6 py-8 md:px-10 md:py-12">
      <ScreenHeader title="Rechercher" subtitle="Cherche dans tes carnets, pages et notes manuscrites via OCR." />

      <div className="mt-8 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-[var(--shadow-sm)] transition focus-within:border-primary focus-within:shadow-[var(--shadow-md)] focus-within:ring-2 focus-within:ring-primary/15">
        <Search size={20} className="shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder="Rechercher une notion, un mot manuscrit, un carnet…"
          className="flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        {hasQuery ? (
          <button type="button" onClick={() => setQuery("")} className="shrink-0 text-muted-foreground hover:text-foreground">
            <Close size={17} />
          </button>
        ) : (
          <Badge className="shrink-0 bg-accent text-accent-foreground">OCR</Badge>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
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

      {!hasQuery && (
        <>
          <div className="mt-8">
            <Eyebrow>Recherches récentes</Eyebrow>
            <div className="mt-3 flex flex-wrap gap-2">
              {searchSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setQuery(s)}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-[13px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                >
                  <Clock size={13} /> {s}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <Eyebrow>Conseils de recherche</Eyebrow>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {tips.map((tip) => (
                <Card key={tip.title} className="flex gap-3 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <tip.icon size={17} />
                  </span>
                  <div>
                    <div className="text-[13px] font-medium text-foreground">{tip.title}</div>
                    <div className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{tip.desc}</div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      {hasQuery && results.length === 0 && (
        <EmptyState icon={<Search size={28} />} title="Aucun résultat" body={`Rien trouvé pour « ${query} ». Essaie un autre terme ou vérifie l'orthographe.`} />
      )}

      {hasQuery && results.length > 0 && (
        <div className="mt-8 space-y-6">
          <ResultSection label="Notes manuscrites" badge="OCR" items={results.filter((r) => r.type === "note")} />
          <ResultSection label="Carnets" items={results.filter((r) => r.type === "notebook")} />
          <ResultSection label="Contenu IA" badge="IA" items={results.filter((r) => r.type === "ai")} />
        </div>
      )}
    </div>
  );
}
