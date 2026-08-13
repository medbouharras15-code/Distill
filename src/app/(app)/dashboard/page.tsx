"use client";

import Link from "next/link";
import { AiOrb } from "@/components/Brand";
import { SheetPreview } from "@/components/notes/SheetPreview";
import { Badge, Card, Eyebrow, buttonClasses } from "@/components/ui";
import { mockHistoryItems, mockNotebooks } from "@/lib/appMockData";
import { Cards, ChevronRight, Clock, Doc, Plus } from "@/lib/icons";
import { PAPER_SIZES } from "@/lib/notes/sheets";

const sparkline = [10, 14, 9, 18, 15, 22, 19, 26];

function Sparkline({ color = "var(--primary)" }: { color?: string }) {
  const max = Math.max(...sparkline);
  const points = sparkline
    .map((v, i) => `${(i / (sparkline.length - 1)) * 100},${28 - (v / max) * 24}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const totalPages = mockNotebooks.reduce((sum, n) => sum + n.pages, 0);
const stats = [
  { label: "Carnets", value: String(mockNotebooks.length), sub: "+1 cette semaine" },
  { label: "Pages écrites", value: String(totalPages), sub: "18 aujourd'hui" },
  { label: "Flashcards", value: "148", sub: "92 % maîtrisées" },
  { label: "Temps d'étude", value: "12 h", sub: "cette semaine" },
];

const dateLabel = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());

export default function DashboardPage() {
  const recent = mockNotebooks.slice(0, 3);

  return (
    <div className="mx-auto max-w-[1240px] animate-fade px-6 py-8 md:px-10 md:py-12">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>
            {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} · Bonne session
          </Eyebrow>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-[0.98] tracking-[-0.03em] text-foreground sm:text-5xl">
            Bonjour.
          </h1>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Reprends là où tu t&apos;es arrêté·e, ou laisse l&apos;IA transformer tes notes en révisions.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/notes" className={buttonClasses("outline", "md", "gap-2")}>
            <Doc size={18} /> Nouvelle page
          </Link>
          <Link href="/notebooks/new" className={buttonClasses("primary", "md", "gap-2")}>
            <Plus size={18} /> Nouveau carnet
          </Link>
        </div>
      </header>

      {/* Stats */}
      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s, i) => (
          <Card key={s.label} className="group relative overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
            <div className="flex items-start justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{s.label}</div>
              <span className="h-1.5 w-1.5 rounded-full bg-primary/40 transition group-hover:bg-primary" />
            </div>
            <div className="mt-3 font-display text-[34px] leading-none tracking-tight tabular-nums text-foreground">{s.value}</div>
            <div className="-mx-1 mt-3 opacity-70">
              <Sparkline color={i === 2 ? "var(--ai-2)" : "var(--primary)"} />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">{s.sub}</div>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        {/* Recent notebooks */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Carnets récents</h2>
            <Link href="/notebooks" className="flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground">
              Voir tout <ChevronRight size={15} />
            </Link>
          </div>
          <div className="space-y-3">
            {recent.map((n) => {
              const ratio = PAPER_SIZES.find((p) => p.value === n.paperSize)?.ratio ?? PAPER_SIZES[0].ratio;
              return (
                <Link key={n.id} href="/notes" className="group block w-full text-left">
                  <Card className="flex items-center gap-4 overflow-hidden p-3 transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-md)]">
                    <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl">
                      <SheetPreview sheetType={n.sheetType} backgroundColor="#ffffff" ratio={ratio} width={64} className="h-full w-full" />
                      <span className="absolute left-0 top-0 h-full w-1" style={{ background: n.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="h-2 w-2 rounded-full" style={{ background: n.color }} /> {n.subject}
                      </div>
                      <div className="mt-1 truncate font-medium text-foreground">{n.title}</div>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Badge className="bg-secondary text-secondary-foreground">{n.pages} pages</Badge>
                        <span>{n.updated}</span>
                      </div>
                    </div>
                    <span className="text-muted-foreground opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100">
                      <ChevronRight size={20} />
                    </span>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="flex flex-col gap-6">
          {/* AI card */}
          <Card className="relative overflow-hidden p-6">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full ai-gradient opacity-20 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <AiOrb size={40} active />
                <div>
                  <div className="text-[13px] font-semibold text-foreground">IA Distill</div>
                  <div className="text-[11px] text-muted-foreground">Ton assistant d&apos;étude</div>
                </div>
              </div>
              <h3 className="mt-4 font-display text-[22px] leading-snug tracking-tight text-foreground">
                Transforme tes notes <span className="ai-text">en révisions</span>.
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Résumés et flashcards générés à partir de ton texte, d&apos;une photo ou d&apos;un PDF.
              </p>
              {/* TODO : pointera vers /notes une fois le panneau IA fusionné
                  dans l'éditeur — comportement inchangé en attendant sur /distill. */}
              <Link
                href="/distill"
                className="mt-5 inline-flex items-center gap-2 rounded-full ai-gradient px-4 py-2.5 text-sm font-medium text-white shadow-[0_8px_24px_-10px_var(--ai-glow)] transition hover:-translate-y-px"
              >
                <Cards size={16} /> Générer maintenant
              </Link>
            </div>
          </Card>

          {/* Activity */}
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground">
              <Clock size={16} className="text-muted-foreground" /> Activité récente
            </div>
            <ul className="space-y-3">
              {mockHistoryItems.slice(0, 4).map((h) => (
                <li key={h.id} className="flex gap-3">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <div className="truncate text-sm text-foreground">{h.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {h.action} · {h.time}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
