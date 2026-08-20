"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, ViewTransition } from "react";
import { AiOrb, Wordmark } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge, buttonClasses } from "@/components/ui";
import { Books, Brain, Clock, Crown, Gear, Home, Lock, LogOut, Plus, Question, Search, Star } from "@/lib/icons";

interface NavItem {
  href: string;
  label: string;
  icon: (props: { size?: number; className?: string }) => React.ReactElement;
}

const nav: NavItem[] = [
  { href: "/dashboard", label: "Accueil", icon: Home },
  { href: "/notebooks", label: "Mes carnets", icon: Books },
  { href: "/favorites", label: "Favoris", icon: Star },
  { href: "/history", label: "Historique", icon: Clock },
  { href: "/search", label: "Rechercher", icon: Search },
];

interface AppShellProps {
  email: string;
  subscribed: boolean;
  children: ReactNode;
}

/** Coquille de navigation principale des utilisateurs connectés (sidebar +
 * en-tête + barre mobile), sur le modèle du Figma Make "NoteFlash" —
 * remplace l'ancien en-tête minimal par écran. L'éditeur (`/notes`, qui
 * inclut désormais le panneau IA résumé/flashcards) reste volontairement en
 * dehors de cette coquille : comme dans la référence, il occupe tout
 * l'écran sans chrome de navigation. */
export function AppShell({ email, subscribed, children }: AppShellProps) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const initial = (email[0] ?? "?").toUpperCase();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col overflow-y-auto border-r border-border bg-card/60 px-3.5 py-5 backdrop-blur md:flex">
        <Link href="/dashboard" className="px-2.5 py-1">
          <Wordmark size={22} />
        </Link>

        <Link
          href="/notebooks/new"
          className={buttonClasses("primary", "lg", "group mt-7 w-full justify-start gap-2.5")}
        >
          <Plus size={18} className="transition-transform group-hover:rotate-90" /> Nouveau carnet
        </Link>

        <div className="mt-6 px-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
          Espace
        </div>
        <nav className="mt-2 space-y-0.5">
          {nav.map((n) => {
            const on = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition ${
                  on ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                {on && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />}
                <n.icon size={19} className={on ? "text-primary" : ""} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* Accès rapide IA — page dédiée en plein écran (résumé/flashcards
            à partir de texte/photo/PDF), voir @/components/notes/AiFullScreen.
            Deuxième point d'accès à l'IA, en plus du panneau latéral de
            l'éditeur (/notes, son bouton "IA" reste inchangé). */}
        <Link
          href="/distill"
          className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-gradient-to-br from-secondary/60 to-card p-3 text-left transition hover:border-[color-mix(in_srgb,var(--ai-2)_40%,transparent)] hover:shadow-[var(--shadow-md)]"
        >
          <AiOrb size={34} />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold">IA Distill</div>
            <div className="truncate text-[11px] text-muted-foreground">Résume & révise</div>
          </div>
        </Link>

        {/* Team Brain — nouvelle fonctionnalité en aperçu (design uniquement,
            voir @/components/team-brain) : aucun compte n'a l'abonnement
            Team correspondant aujourd'hui, d'où le verrouillage visuel
            (cadenas + badge "Team") plutôt qu'un accès direct. */}
        <Link
          href="/team-brain"
          className="mt-2 flex items-center gap-3 rounded-2xl border border-border bg-gradient-to-br from-secondary/60 to-card p-3 text-left transition hover:border-[color-mix(in_srgb,var(--team-2)_40%,transparent)] hover:shadow-[var(--shadow-md)]"
        >
          <span
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: "linear-gradient(135deg, var(--team) 0%, var(--team-2) 100%)" }}
          >
            <Brain size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold">Team Brain</span>
              <Lock size={11} className="text-muted-foreground/60" />
            </div>
            <div className="truncate text-[11px] text-muted-foreground">Mémoire d&apos;équipe IA</div>
          </div>
          <Badge className="shrink-0 bg-amber-100 text-amber-800">Team</Badge>
        </Link>

        <div className="mt-auto space-y-1 pt-4">
          <Link
            href="/subscription"
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition ${
              isActive("/subscription") ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            }`}
          >
            <Crown size={19} className={isActive("/subscription") ? "text-primary" : ""} /> Abonnement
          </Link>
          <Link
            href="/settings"
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition ${
              isActive("/settings") ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            }`}
          >
            <Gear size={19} className={isActive("/settings") ? "text-primary" : ""} /> Paramètres
          </Link>
          <Link
            href="/faq"
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition ${
              isActive("/faq") ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            }`}
          >
            <Question size={19} className={isActive("/faq") ? "text-primary" : ""} /> FAQ
          </Link>
          <div className="mt-2 flex w-full items-center gap-1 rounded-2xl border border-border bg-card p-2.5 transition hover:border-primary/40 hover:shadow-[var(--shadow-sm)]">
            <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{email}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {subscribed ? "Distill Pro · Gérer" : "Offre gratuite · Gérer"}
                </div>
              </div>
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                aria-label="Déconnexion"
                title="Déconnexion"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-6 backdrop-blur">
          <div className="md:hidden">
            <Wordmark size={20} />
          </div>
          <Link
            href="/search"
            className="ml-auto hidden items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground md:flex md:w-72"
          >
            <Search size={17} /> Rechercher…
          </Link>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <ThemeToggle />
            {subscribed && <Badge className="hidden bg-accent-light/50 text-accent-dark sm:inline-flex">✦ Pro</Badge>}
          </div>
        </header>
        <main className="flex-1 pb-16 md:pb-0">
          {/* Fondu-enchaîné natif entre les écrans de cette coquille
              (Dashboard, Mes carnets, Favoris…) — la sidebar/l'en-tête ne
              sont volontairement PAS dans ce wrapper : eux ne changent
              jamais d'une navigation à l'autre, seul ce contenu doit
              participer à la transition (sinon la sidebar clignoterait à
              chaque clic). Sans props, ViewTransition applique le
              fondu-enchaîné par défaut de React — aucune CSS ni config
              requise ; sans support navigateur, la navigation reste
              instantanée comme avant (dégradation silencieuse). */}
          <ViewTransition>{children}</ViewTransition>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-card/95 py-2 backdrop-blur md:hidden">
        {nav.slice(0, 4).map((n) => {
          const on = isActive(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] ${on ? "text-primary" : "text-muted-foreground"}`}
            >
              <n.icon size={21} /> {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
