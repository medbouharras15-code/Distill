"use client";

import { useState } from "react";
import { ChatView } from "./ChatView";
import { MembersView } from "./MembersView";
import { ProjectView } from "./ProjectView";
import { UpsellView } from "./UpsellView";
import { WorkspaceView } from "./WorkspaceView";
import type { TeamBrainWorkspaceData } from "@/lib/teamBrainData";
import type { TeamBrainProject } from "@/lib/teamBrainMockData";
import { TEAM_BRAIN_MEMBERS, TEAM_BRAIN_NIKE_DOCS, TEAM_BRAIN_PROJECTS, TEAM_BRAIN_WORKSPACE } from "@/lib/teamBrainMockData";

type TeamBrainView = "workspace" | "project" | "chat" | "members";

const MOCK_WORKSPACE: TeamBrainWorkspaceData = {
  teamName: TEAM_BRAIN_WORKSPACE.name,
  memberCount: TEAM_BRAIN_WORKSPACE.members,
  documentCount: TEAM_BRAIN_PROJECTS.reduce((sum, p) => sum + p.docs, 0),
  projects: TEAM_BRAIN_PROJECTS,
  // Non utilisés côté démo : ProjectView/MembersView reçoivent toujours
  // TEAM_BRAIN_NIKE_DOCS/TEAM_BRAIN_MEMBERS directement pour un projet mock
  // (voir plus bas) — juste présents ici pour satisfaire le type.
  documentsByProject: {},
  roster: [],
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
 * Workspace/Projet/Chat/Membres sont maintenant tous branchés sur les
 * vraies données en mode réel (voir @/lib/teamBrainData) — la démo reste
 * inchangée sur teamBrainMockData quand `initialTeam` est `null`.
 *
 * `unlocked` est dérivé à chaque rendu (`Boolean(initialTeam) ||
 * demoUnlocked`) plutôt que stocké tel quel : après une création d'équipe
 * réussie (voir CreateTeamForm), `router.refresh()` fait remonter un
 * nouvel `initialTeam` non nul en tant que PROP, qui doit immédiatement se
 * refléter sans geste supplémentaire — un état local initialisé une seule
 * fois au montage ne l'aurait pas capté. `demoUnlocked`, lui, ne retient
 * que le choix explicite de la démo ("Explorer la démo"). */
export function TeamBrain({ initialTeam }: { initialTeam: TeamBrainWorkspaceData | null }) {
  const [demoUnlocked, setDemoUnlocked] = useState(false);
  const [view, setView] = useState<TeamBrainView>("workspace");
  const [activeProject, setActiveProject] = useState<TeamBrainProject>(
    initialTeam?.projects[0] ?? TEAM_BRAIN_PROJECTS[0],
  );

  const unlocked = Boolean(initialTeam) || demoUnlocked;

  if (!unlocked) {
    return <UpsellView onUnlock={() => setDemoUnlocked(true)} />;
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
          isReal={isReal}
          onOpenProject={openProject}
          onMembers={() => setView("members")}
        />
      )}
      {view === "project" && (
        <ProjectView
          project={activeProject}
          docs={isReal ? (workspace.documentsByProject[activeProject.id] ?? []) : TEAM_BRAIN_NIKE_DOCS}
          isReal={isReal}
          onBack={() => setView("workspace")}
          onChat={() => setView("chat")}
        />
      )}
      {view === "chat" && (
        <ChatView
          project={activeProject}
          isReal={isReal}
          onBack={() => setView("project")}
          onBackToWorkspace={() => setView("workspace")}
        />
      )}
      {view === "members" && (
        <MembersView
          members={isReal ? workspace.roster : TEAM_BRAIN_MEMBERS}
          teamName={workspace.teamName}
          onBack={() => setView("workspace")}
        />
      )}
    </div>
  );
}
