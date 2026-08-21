"use client";

import { useState } from "react";
import { ChatView } from "./ChatView";
import { MembersView } from "./MembersView";
import { ProjectView } from "./ProjectView";
import { UpsellView } from "./UpsellView";
import { WorkspaceView } from "./WorkspaceView";
import type { TeamBrainWorkspaceData } from "@/lib/teamBrainData";
import type { TeamBrainProject } from "@/lib/teamBrainMockData";
import { TEAM_BRAIN_NIKE_DOCS, TEAM_BRAIN_PROJECTS, TEAM_BRAIN_WORKSPACE } from "@/lib/teamBrainMockData";

type TeamBrainView = "workspace" | "project" | "chat" | "members";

const MOCK_WORKSPACE: TeamBrainWorkspaceData = {
  teamName: TEAM_BRAIN_WORKSPACE.name,
  memberCount: TEAM_BRAIN_WORKSPACE.members,
  documentCount: TEAM_BRAIN_PROJECTS.reduce((sum, p) => sum + p.docs, 0),
  projects: TEAM_BRAIN_PROJECTS,
};

/** Racine de Team Brain (étape 4/4, vue Workspace branchée sur de vraies
 * données — voir plan validé). Navigation par état local plutôt que par
 * sous-routes Next.js, fidèle à la structure du prototype Figma Make
 * source.
 *
 * `initialTeam` (chargé côté serveur, voir @/app/(app)/team-brain/page.tsx)
 * détermine le mode :
 * - une vraie équipe → accès direct à la vraie vue Workspace, aucun geste
 *   requis (`unlocked` démarre à `true`) ;
 * - aucune équipe (le cas de tout le monde aujourd'hui, faute de flux de
 *   création — voir plan validé) → écran verrouillé habituel, avec la démo
 *   sur données mock accessible via "Explorer la démo", inchangée.
 *
 * Project/Chat/Membres restent sur les données mock (TEAM_BRAIN_NIKE_DOCS)
 * même en mode réel : leur branchement est prévu aux sous-étapes suivantes.
 * Ouvrir un vrai projet passe donc `docs={[]}` plutôt que les documents
 * fictifs Nike, qui n'ont aucun rapport avec un vrai projet — une liste
 * vide reste honnête, ProjectView l'affiche déjà correctement. */
export function TeamBrain({ initialTeam }: { initialTeam: TeamBrainWorkspaceData | null }) {
  const [unlocked, setUnlocked] = useState(Boolean(initialTeam));
  const [view, setView] = useState<TeamBrainView>("workspace");
  const [activeProject, setActiveProject] = useState<TeamBrainProject>(
    initialTeam?.projects[0] ?? TEAM_BRAIN_PROJECTS[0],
  );

  if (!unlocked) {
    return <UpsellView onUnlock={() => setUnlocked(true)} />;
  }

  const isReal = Boolean(initialTeam);
  const workspace = initialTeam ?? MOCK_WORKSPACE;

  const openProject = (project: TeamBrainProject) => {
    setActiveProject(project);
    setView("project");
  };

  return (
    <div className="flex min-h-full flex-col bg-background">
      {view === "workspace" && (
        <WorkspaceView
          teamName={workspace.teamName}
          memberCount={workspace.memberCount}
          documentCount={workspace.documentCount}
          projects={workspace.projects}
          onOpenProject={openProject}
          onMembers={() => setView("members")}
        />
      )}
      {view === "project" && (
        <ProjectView
          project={activeProject}
          docs={isReal ? [] : TEAM_BRAIN_NIKE_DOCS}
          onBack={() => setView("workspace")}
          onChat={() => setView("chat")}
        />
      )}
      {view === "chat" && (
        <ChatView project={activeProject} onBack={() => setView("project")} onBackToWorkspace={() => setView("workspace")} />
      )}
      {view === "members" && <MembersView onBack={() => setView("workspace")} />}
    </div>
  );
}
