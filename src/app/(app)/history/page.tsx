"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ScreenHeader } from "@/components/LibraryScreens";
import { Badge, Card, Eyebrow } from "@/components/ui";
import { AI_HISTORY_ACTIONS, mockHistoryItems, mockNotebooks } from "@/lib/appMockData";
import { Books, Cards, Clock, Doc, Sparkle, TextTool } from "@/lib/icons";

const actionIcons: Record<string, typeof Doc> = {
  "Résumé généré": Doc,
  "Flashcards créées": Cards,
  "Page modifiée": TextTool,
  "Fiche de révision": Sparkle,
  "Écriture convertie en texte": TextTool,
};

const filters = ["Tout", "Pages ouvertes", "Actions IA", "Modifications"];
const groupOrder = ["Aujourd'hui", "Hier", "Il y a 2 jours"] as const;

export default function HistoryPage() {
  const [filter, setFilter] = useState("Tout");

  const groups = useMemo(() => {
    const items = mockHistoryItems.filter((h) => {
      if (filter === "Tout") return true;
      if (filter === "Actions IA") return AI_HISTORY_ACTIONS.includes(h.action);
      if (filter === "Modifications") return h.action === "Page modifiée";
      if (filter === "Pages ouvertes") return true;
      return true;
    });
    return groupOrder
      .map((label) => ({ label, items: items.filter((h) => h.group === label) }))
      .filter((g) => g.items.length > 0);
  }, [filter]);

  const lastPage = mockHistoryItems[0];
  const lastNotebook = mockNotebooks[0];
  const lastFlashcards = mockHistoryItems.find((h) => h.action === "Flashcards créées");
  const lastSummary = mockHistoryItems.find((h) => h.action === "Résumé généré");

  const quickAccess = [
    { label: "Dernière page", icon: Doc, nb: lastPage.title, desc: lastPage.time },
    { label: "Dernier carnet", icon: Books, nb: lastNotebook?.title ?? "—", desc: lastNotebook ? `${lastNotebook.pages} pages` : "" },
    { label: "Dernières flashcards", icon: Cards, nb: lastFlashcards?.title ?? "—", desc: lastFlashcards?.time ?? "" },
    { label: "Dernier résumé", icon: Sparkle, nb: lastSummary?.title ?? "—", desc: lastSummary?.time ?? "" },
  ];

  return (
    <div className="mx-auto max-w-[1000px] animate-fade px-6 py-8 md:px-10 md:py-12">
      <ScreenHeader title="Historique" subtitle="Tout ce que tu as créé et révisé récemment." />

      <div className="mt-8 flex flex-wrap gap-2">
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

      <div className="mt-8 space-y-8">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="mb-3 flex items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{group.label}</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="relative space-y-2 pl-6">
              <div className="absolute bottom-2 left-[7px] top-2 w-px bg-border" />
              {group.items.map((h) => {
                const Icon = actionIcons[h.action] ?? Clock;
                const isAi = AI_HISTORY_ACTIONS.includes(h.action);
                return (
                  <Link key={h.id} href="/notes" className="group relative block w-full text-left">
                    <span
                      className={`absolute -left-6 top-4 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background ${
                        isAi ? "bg-[var(--ai-1)]" : "bg-primary"
                      }`}
                    />
                    <Card className="flex items-center gap-4 p-4 transition group-hover:border-primary/40 group-hover:shadow-[var(--shadow-md)]">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          isAi
                            ? "bg-gradient-to-br from-[color-mix(in_srgb,var(--ai-1)_15%,transparent)] to-[color-mix(in_srgb,var(--ai-3)_15%,transparent)] text-[var(--ai-2)]"
                            : "bg-accent text-accent-foreground"
                        }`}
                      >
                        <Icon size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{h.title}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{h.notebook}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <Badge className={isAi ? "ai-text bg-transparent px-0 text-[11px]" : "bg-secondary text-secondary-foreground"}>
                          {h.action}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">{h.time}</span>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12">
        <Eyebrow>Accès rapide</Eyebrow>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickAccess.map((item) => (
            <Link key={item.label} href="/notes" className="group text-left">
              <Card className="p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-md)]">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <item.icon size={17} />
                </div>
                <div className="text-[11px] text-muted-foreground">{item.label}</div>
                <div className="mt-0.5 truncate text-sm font-medium leading-snug text-foreground">{item.nb}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{item.desc}</div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
