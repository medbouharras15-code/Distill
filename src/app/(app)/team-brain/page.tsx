import { redirect } from "next/navigation";
import { TeamBrain } from "@/components/team-brain/TeamBrain";
import { getUserAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTeamWorkspaceData, getUserActiveTeam } from "@/lib/teamBrainData";

/** Team Brain — vue Workspace branchée sur de vraies données (étape 4/4),
 * Projet/Chat/Membres encore sur données mock (voir @/components/team-brain/TeamBrain).
 * Même garde d'authentification que le reste des pages de l'espace connecté. */
export default async function TeamBrainPage() {
  const auth = await getUserAndProfile();
  if (!auth) {
    redirect("/");
  }

  const supabase = await createClient();
  const activeTeam = await getUserActiveTeam(supabase, auth.user.id);
  const initialTeam = activeTeam ? await getTeamWorkspaceData(supabase, activeTeam.teamId, activeTeam.teamName) : null;

  return <TeamBrain initialTeam={initialTeam} />;
}
