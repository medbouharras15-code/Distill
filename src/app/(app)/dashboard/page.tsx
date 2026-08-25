"use client";

import Link from "next/link";
import { AiOrb } from "@/components/Brand";
import { SheetPreview } from "@/components/notes/SheetPreview";
import { Badge, Card, Eyebrow, buttonClasses, staggerDelay } from "@/components/ui";
import { mockHistoryItems, mockNotebooks } from "@/lib/appMockData";
import { Books, Cards, ChevronRight, Clock, Doc, Plus } from "@/lib/icons";
import { PAPER_SIZES } from "@/lib/notes/sheets";

const totalPages = mockNotebooks.reduce((sum, n) => sum + n.pages, 0);
const stats = [
  { label: "Carnets", value: String(mockNotebooks.length), sub: "+1 cette semaine", icon: Books, tint: "primary" as const },
  { label: "Pages écrites", value: String(totalPages), sub: "18 aujourd'hui", icon: Doc, tint: "primary" as const },
  { label: "Flashcards", value: "148", sub: "92 % maîtrisées", icon: Cards, tint: "ai" as const },
  { label: "Temps d'étude", value: "12 h", sub: "cette semaine", icon: Clock, tint: "primary" as const },
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
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[0.97] tracking-[-0.03em] text-foreground sm:text-5xl">
            Bonjour.
          </h1>
          <p className="mt-3.5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
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

      {/* Stats — pas de mini-graphique : les 4 cartes réutilisaient la même
          série factice, ce qui se voyait dès qu'on comparait les cartes
          entre elles. Un chiffre net plutôt qu'une fausse tendance. */}
      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s, i) => (
          <Card
            key={s.label}
            className="card-hover group relative animate-fade overflow-hidden p-6"
            style={staggerDelay(i)}
          >
            <div className="flex items-start justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{s.label}</div>
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-transform duration-300 group-hover:scale-110 ${
                  s.tint === "ai" ? "ai-gradient text-white" : "bg-accent-light text-accent-dark"
                }`}
              >
                <s.icon size={14} />
              </span>
            </div>
            <div className="mt-4 font-display text-[36px] leading-none tracking-tight tabular-nums text-foreground">{s.value}</div>
            <div className="mt-2.5 text-[11px] text-muted-foreground">{s.sub}</div>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        {/* Recent notebooks */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Carnets récents</h2>
            <Link
              href="/notebooks"
              className="group flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              Voir tout
              <ChevronRight
                size={15}
                className="transition-transform duration-200 group-hover:translate-x-0.5"
                style={{ transitionTimingFunction: "var(--ease-signature)" }}
              />
            </Link>
          </div>
          {recent.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-secondary text-muted-foreground/60">
                <Books size={20} />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">Pas encore de carnet</div>
                <p className="mt-1 text-[13px] text-muted-foreground">Crée ton premier carnet pour commencer à réviser.</p>
              </div>
              <Link href="/notebooks/new" className={buttonClasses("outline", "sm", "mt-1")}>
                Créer un carnet
              </Link>
            </Card>
          ) : (
          <div className="space-y-3">
            {recent.map((n, i) => {
              const ratio = PAPER_SIZES.find((p) => p.value === n.paperSize)?.ratio ?? PAPER_SIZES[0].ratio;
              return (
                <Link key={n.id} href="/notes" className="group block w-full text-left">
                  <Card className="card-hover flex animate-fade items-center gap-4 overflow-hidden p-4" style={staggerDelay(i)}>
                    <div className="h-24 w-[72px] shrink-0 overflow-hidden rounded-xl">
                      <SheetPreview sheetType={n.sheetType} backgroundColor="#ffffff" ratio={ratio} width={72} className="h-full w-full" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: n.color }} aria-hidden="true" /> {n.subject}
                      </div>
                      <div className="mt-1.5 truncate font-medium text-foreground">{n.title}</div>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Badge className="bg-secondary text-secondary-foreground">{n.pages} pages</Badge>
                        <span>{n.updated}</span>
                      </div>
                    </div>
                    <span
                      className="text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                      style={{ transitionTimingFunction: "var(--ease-signature)" }}
                    >
                      <ChevronRight size={20} />
                    </span>
                  </Card>
                </Link>
              );
            })}
          </div>
          )}
        </section>

        <div className="flex flex-col gap-6">
          {/* AI card — un raccourci discret, pas une bannière publicitaire :
              pas de halo animé ni de gros bouton, juste l'orbe (déjà le
              repère d'identité IA de l'app) et un lien texte. */}
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <AiOrb size={36} active />
              <div className="text-[13px] font-semibold text-foreground">IA Distill</div>
            </div>
            <h3 className="mt-4 font-display text-lg leading-snug tracking-tight text-foreground">
              Transforme tes notes <span className="ai-text">en révisions</span>.
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Résumés et flashcards générés à partir de ton texte, d&apos;une photo ou d&apos;un PDF.
            </p>
            <Link
              href="/distill"
              className="group mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-dark transition-colors duration-200 hover:text-accent"
            >
              Générer maintenant
              <ChevronRight
                size={15}
                className="transition-transform duration-200 group-hover:translate-x-0.5"
                style={{ transitionTimingFunction: "var(--ease-signature)" }}
              />
            </Link>
          </Card>

          {/* Activity */}
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground">
              <Clock size={16} className="text-muted-foreground" /> Activité récente
            </div>
            {/* Petite chronologie plutôt qu'une liste plate : un fil relie
                les puces (même idée que "Comment ça marche" sur la
                landing), à l'échelle d'une carte compacte. */}
            <div className="relative">
              <div aria-hidden="true" className="pointer-events-none absolute bottom-2 left-[3px] top-2 w-px bg-border" />
              <ul className="space-y-1">
                {mockHistoryItems.slice(0, 4).map((h, i) => (
                  <li
                    key={h.id}
                    className="flex animate-fade items-start gap-3 rounded-xl p-2 -m-2 transition-colors duration-300 hover:bg-secondary/60"
                    style={staggerDelay(i)}
                  >
                    <div className="relative z-10 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary ring-4 ring-card" />
                    <div className="min-w-0">
                      <div className="truncate text-sm text-foreground">{h.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {h.action} · {h.time}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
