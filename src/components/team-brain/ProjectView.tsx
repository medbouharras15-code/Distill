import { Badge, Eyebrow } from "@/components/ui";
import { Brain, ChevronLeft, Clock, Lock, Plus, Shield } from "@/lib/icons";
import { AddDocumentForm } from "./AddDocumentForm";
import { ComingSoonToast, useComingSoonToast } from "./ComingSoonToast";
import type { TeamBrainDoc, TeamBrainProject } from "@/lib/teamBrainMockData";

const TYPE_COLORS = { note: "#0c6b52", pdf: "#b5693a", doc: "#4b5d8b" };
const TYPE_LABELS = { note: "Note", pdf: "PDF", doc: "Doc" };

function DocRow({ doc }: { doc: TeamBrainDoc }) {
  return (
    <div
      className={`group flex items-center gap-4 rounded-2xl border bg-card p-4 transition hover:shadow-[var(--shadow-sm)] ${
        doc.private ? "border-dashed opacity-75" : "border-border"
      }`}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white"
        style={{ background: `color-mix(in srgb, ${TYPE_COLORS[doc.type]} 85%, transparent)` }}
      >
        {TYPE_LABELS[doc.type]}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-foreground">{doc.name}</span>
          {doc.private && (
            <Badge className="shrink-0 bg-secondary text-[10px] text-muted-foreground">
              <Lock size={9} /> Privé
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground">
          <Clock size={11} /> {doc.date} · {doc.pages} page{doc.pages > 1 ? "s" : ""}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ background: doc.avatarColor }}
        >
          {doc.initials}
        </div>
        <span className="hidden text-[12px] text-muted-foreground sm:block">{doc.addedBy}</span>
      </div>
    </div>
  );
}

/** Vue d'un projet Team Brain — liste de documents factices. "Ajouter un
 * document" appelle réellement l'API d'indexation pour un vrai projet
 * (`isReal`, voir AddDocumentForm.tsx) ; en mode démo, il reste décoratif
 * comme avant, inchangé. */
export function ProjectView({
  project,
  docs,
  isReal,
  onBack,
  onChat,
}: {
  project: TeamBrainProject;
  docs: TeamBrainDoc[];
  isReal: boolean;
  onBack: () => void;
  onChat: () => void;
}) {
  const { visible: comingSoonVisible, trigger: triggerComingSoon } = useComingSoonToast();

  return (
    <div className="mx-auto max-w-[760px] animate-fade px-5 py-8 md:px-10 md:py-12">
      <ComingSoonToast visible={comingSoonVisible} />
      <button
        type="button"
        onClick={onBack}
        className="mb-8 flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ChevronLeft size={15} /> Workspace
      </button>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl shadow-[var(--shadow-md)]"
            style={{ background: `color-mix(in srgb, ${project.color} 14%, var(--secondary))` }}
          >
            {project.emoji}
          </div>
          <div>
            <h1 className="font-display text-[26px] font-medium tracking-tight text-foreground">{project.name}</h1>
            <p className="text-[13px] text-muted-foreground">
              {docs.filter((d) => !d.private).length} documents partagés · {docs.filter((d) => d.private).length} privé
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onChat}
          className="flex shrink-0 items-center gap-2 rounded-2xl px-5 py-3 text-[13.5px] font-semibold text-white shadow-[0_4px_16px_-6px_var(--team-glow)] transition hover:-translate-y-px hover:brightness-105"
          style={{ background: "linear-gradient(135deg, var(--team) 0%, var(--team-2) 100%)" }}
        >
          <Brain size={16} />
          Interroger Team Brain
        </button>
      </div>

      <div className="space-y-2">
        <Eyebrow>Documents du projet</Eyebrow>
        <div className="mt-3 space-y-2">
          {docs.map((doc) => (
            <DocRow key={doc.id} doc={doc} />
          ))}
        </div>
      </div>

      {isReal ? (
        <AddDocumentForm projectId={project.id} />
      ) : (
        <button
          type="button"
          onClick={triggerComingSoon}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-4 text-[13px] text-muted-foreground transition hover:border-[var(--team)] hover:text-foreground"
        >
          <Plus size={16} /> Ajouter un document ou une note
        </button>
      )}

      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-[13px]">
        <Shield size={16} className="mt-0.5 shrink-0" style={{ color: "var(--team)" }} />
        <div className="text-muted-foreground">
          <span className="font-medium text-foreground">Documents privés</span> — visibles uniquement par leur
          propriétaire. Team Brain ne peut pas citer leur contenu pour les autres membres.
        </div>
      </div>
    </div>
  );
}
