import Link from "next/link";
import { Card } from "@/components/ui";
import { Brain, ChevronLeft, ChevronRight, Clock, Doc, Plus, Users } from "@/lib/icons";
import { ComingSoonToast, useComingSoonToast } from "./ComingSoonToast";
import { colorForInitial } from "@/lib/teamBrainData";
import type { TeamBrainProject } from "@/lib/teamBrainMockData";

function ProjectCard({ project, onClick }: { project: TeamBrainProject; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group paper-grain relative overflow-hidden rounded-[22px] border border-border bg-card p-5 text-left shadow-[var(--shadow-sm)] transition-all hover:-translate-y-px hover:shadow-[var(--shadow-md)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 h-24 w-24 opacity-10 blur-2xl"
        style={{ background: project.color }}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl shadow-[var(--shadow-sm)]"
              style={{ background: `color-mix(in srgb, ${project.color} 12%, var(--secondary))` }}
            >
              {project.emoji}
            </div>
            <div>
              <div className="font-display text-[16px] font-medium text-foreground">{project.name}</div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Doc size={10} /> {project.docs} documents
              </div>
            </div>
          </div>
          <ChevronRight size={16} className="mt-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex -space-x-1.5">
            {project.members.slice(0, 4).map((m, i) => (
              <div
                key={m + i}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card text-[9px] font-bold text-white"
                style={{ background: colorForInitial(m), zIndex: 4 - i }}
              >
                {m[0]}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock size={11} /> {project.lastActivity}
          </div>
        </div>
      </div>
    </button>
  );
}

/** Vue d'accueil Team Brain — grille de projets + statistiques, alimentée
 * soit par de vraies données (équipe réelle, voir @/lib/teamBrainData),
 * soit par le mock de démo (voir TeamBrain.tsx) : ce composant ne sait pas
 * laquelle, il affiche simplement ce qu'on lui passe. "Nouveau projet"
 * reste décoratif dans les deux cas (pas de flux de création, conformément
 * au plan validé). */
export function WorkspaceView({
  teamName,
  memberCount,
  documentCount,
  projects,
  onOpenProject,
  onMembers,
}: {
  teamName: string;
  memberCount: number;
  documentCount: number;
  projects: TeamBrainProject[];
  onOpenProject: (p: TeamBrainProject) => void;
  onMembers: () => void;
}) {
  const { visible: comingSoonVisible, trigger: triggerComingSoon } = useComingSoonToast();
  const stats = [
    { label: "Documents indexés", value: String(documentCount), icon: Doc },
    { label: "Membres actifs", value: String(memberCount), icon: Users },
  ];

  return (
    <div className="mx-auto max-w-[860px] animate-fade px-5 py-8 md:px-10 md:py-12">
      <ComingSoonToast visible={comingSoonVisible} />
      <Link href="/dashboard" className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
        <ChevronLeft size={15} /> Accueil
      </Link>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-[0_4px_16px_-6px_var(--team-glow)]"
            style={{ background: "linear-gradient(135deg, var(--team) 0%, var(--team-2) 100%)" }}
          >
            <Brain size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[26px] font-medium tracking-tight text-foreground">{teamName}</h1>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white"
                style={{ background: "linear-gradient(115deg, var(--team), var(--team-2))" }}
              >
                Team Brain
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground">
              {memberCount} membre{memberCount > 1 ? "s" : ""} · {projects.length} projet{projects.length > 1 ? "s" : ""} actif
              {projects.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onMembers}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-[13px] text-muted-foreground shadow-[var(--shadow-sm)] transition hover:text-foreground"
          >
            <Users size={15} /> Membres
          </button>
          <button
            type="button"
            onClick={triggerComingSoon}
            className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium text-white shadow-[var(--shadow-sm)] transition hover:-translate-y-px"
            style={{ background: "linear-gradient(135deg, var(--team), var(--team-2))" }}
          >
            <Plus size={15} /> Nouveau projet
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} onClick={() => onOpenProject(p)} />
        ))}

        <button
          type="button"
          onClick={triggerComingSoon}
          className="group flex min-h-[148px] flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-border text-muted-foreground transition hover:border-[var(--team)] hover:text-foreground"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
            <Plus size={20} />
          </div>
          <span className="text-[13px] font-medium">Nouveau projet</span>
        </button>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="flex items-center gap-3 p-4">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: "color-mix(in srgb, var(--team) 80%, var(--team-2))" }}
            >
              <Icon size={16} />
            </div>
            <div>
              <div className="font-display text-2xl font-medium leading-none text-foreground">{value}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
