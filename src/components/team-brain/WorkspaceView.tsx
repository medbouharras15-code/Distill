import { Card } from "@/components/ui";
import { Brain, ChevronRight, Clock, Doc, Plus, Users } from "@/lib/icons";
import { ComingSoonToast, useComingSoonToast } from "./ComingSoonToast";
import { TEAM_BRAIN_MEMBERS, TEAM_BRAIN_WORKSPACE } from "@/lib/teamBrainMockData";
import type { TeamBrainProject } from "@/lib/teamBrainMockData";

const STATS = [
  { label: "Documents indexés", value: "34", icon: Doc },
  { label: "Questions posées", value: "127", icon: Brain },
  { label: "Membres actifs", value: "5", icon: Users },
];

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
                style={{ background: TEAM_BRAIN_MEMBERS.find((mb) => mb.initials === m)?.color ?? "#888", zIndex: 4 - i }}
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

/** Vue d'accueil de la démo Team Brain — grille de projets + statistiques
 * factices. "Nouveau projet" reste décoratif (pas de vraie logique de
 * création, conformément au plan validé). */
export function WorkspaceView({
  projects,
  onOpenProject,
  onMembers,
}: {
  projects: TeamBrainProject[];
  onOpenProject: (p: TeamBrainProject) => void;
  onMembers: () => void;
}) {
  const { visible: comingSoonVisible, trigger: triggerComingSoon } = useComingSoonToast();

  return (
    <div className="mx-auto max-w-[860px] animate-fade px-5 py-8 md:px-10 md:py-12">
      <ComingSoonToast visible={comingSoonVisible} />
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
              <h1 className="font-display text-[26px] font-medium tracking-tight text-foreground">{TEAM_BRAIN_WORKSPACE.name}</h1>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white"
                style={{ background: "linear-gradient(115deg, var(--team), var(--team-2))" }}
              >
                Team Brain
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground">
              {TEAM_BRAIN_WORKSPACE.members} membres · {projects.length} projets actifs
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

      <div className="mt-8 grid grid-cols-3 gap-3">
        {STATS.map(({ label, value, icon: Icon }) => (
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
