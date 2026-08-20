"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { ProjectView } from "./ProjectView";
import { UpsellView } from "./UpsellView";
import { WorkspaceView } from "./WorkspaceView";
import type { TeamBrainProject } from "@/lib/teamBrainMockData";
import { TEAM_BRAIN_NIKE_DOCS, TEAM_BRAIN_PROJECTS } from "@/lib/teamBrainMockData";

type TeamBrainView = "workspace" | "project" | "chat" | "members";

/** Écran de secours pour les vues pas encore construites (voir étapes
 * suivantes du chantier Team Brain) — évite de casser la navigation locale
 * pendant la construction progressive des 5 vues. À retirer une fois
 * ChatView/MembersView tous les deux construits. */
function ComingSoonView({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-[700px] px-5 py-16 text-center md:px-10">
      <Card className="paper-grain p-10">
        <p className="text-sm text-muted-foreground">Écran « {label} » à venir dans une prochaine étape.</p>
      </Card>
    </div>
  );
}

/** Racine de la démo Team Brain — design uniquement, aucune logique de
 * paiement/permissions réelle (voir plan validé). Navigation par état local
 * plutôt que par sous-routes Next.js, fidèle à la structure du prototype
 * Figma Make source. `unlocked` reste toujours `false` au premier rendu :
 * personne n'a d'abonnement Team aujourd'hui, l'utilisateur doit
 * explicitement choisir "Explorer la démo" sur l'écran verrouillé.
 *
 * Les documents affichés en vue Projet sont toujours ceux du projet "Client
 * Nike" (TEAM_BRAIN_NIKE_DOCS) quel que soit le projet ouvert — le
 * prototype Figma Make source n'a de données de démo que pour ce seul
 * projet ; les autres cartes projet de Workspace sont cliquables mais
 * partagent la même liste de documents fictifs. */
export function TeamBrain() {
  const [unlocked, setUnlocked] = useState(false);
  const [view, setView] = useState<TeamBrainView>("workspace");
  const [activeProject, setActiveProject] = useState<TeamBrainProject>(TEAM_BRAIN_PROJECTS[0]);

  if (!unlocked) {
    return <UpsellView onUnlock={() => setUnlocked(true)} />;
  }

  const openProject = (project: TeamBrainProject) => {
    setActiveProject(project);
    setView("project");
  };

  return (
    <div className="flex min-h-full flex-col bg-background">
      {view === "workspace" && (
        <WorkspaceView projects={TEAM_BRAIN_PROJECTS} onOpenProject={openProject} onMembers={() => setView("members")} />
      )}
      {view === "project" && (
        <ProjectView
          project={activeProject}
          docs={TEAM_BRAIN_NIKE_DOCS}
          onBack={() => setView("workspace")}
          onChat={() => setView("chat")}
        />
      )}
      {view === "chat" && <ComingSoonView label="Chat" />}
      {view === "members" && <ComingSoonView label="Membres" />}
    </div>
  );
}
