import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserActiveTeam } from "@/lib/teamBrainData";

/**
 * Écritures Team Brain (création d'équipe/projet, chantier séparé de
 * l'étape 4) — server-only (clé service_role), contrairement à
 * teamBrainData.ts qui reste sans dépendance serveur. Même principe
 * partout : le client de session sert uniquement à vérifier ce que
 * l'appelant peut légitimement faire, l'écriture elle-même passe par
 * service_role une fois l'autorisation confirmée — les tables teams/
 * team_members/team_brain_projects/team_brain_project_members n'ont
 * aucune policy RLS d'écriture (voir supabase/schema.sql), donc aucune
 * autre voie n'est possible.
 */

/** Crée une équipe et y ajoute son créateur comme admin actif. `supabase`
 * doit être le client authentifié de session (sert à vérifier via RLS que
 * l'utilisateur n'a pas déjà une équipe active — pas de sélecteur
 * multi-équipes pour l'instant, voir plan validé). */
export async function createTeam(supabase: SupabaseClient, userId: string, name: string): Promise<{ teamId: string }> {
  const existing = await getUserActiveTeam(supabase, userId);
  if (existing) {
    throw new Error("Vous appartenez déjà à une équipe.");
  }

  const admin = createAdminClient();
  const { data: team, error: teamError } = await admin.from("teams").insert({ name, owner_id: userId }).select("id").single();
  if (teamError || !team) {
    throw new Error("Impossible de créer l'équipe.");
  }

  const { error: memberError } = await admin.from("team_members").insert({
    team_id: team.id,
    user_id: userId,
    role: "admin",
    status: "active",
    joined_at: new Date().toISOString(),
  });
  if (memberError) {
    // Évite une équipe orpheline sans membre si cette deuxième écriture
    // échoue juste après la première.
    await admin.from("teams").delete().eq("id", team.id as string);
    throw new Error("Impossible de vous ajouter à l'équipe créée.");
  }

  return { teamId: team.id as string };
}

/** Crée un projet dans l'équipe active de l'utilisateur et l'y ajoute
 * automatiquement (accès immédiat, quel que soit son rôle). `teamId`
 * n'est jamais un paramètre : toujours dérivé de la session via
 * getUserActiveTeam, donc aucune vérification "est-ce bien SON équipe" à
 * faire séparément — structurellement impossible de créer un projet dans
 * l'équipe de quelqu'un d'autre. */
export async function createProject(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  emoji?: string,
): Promise<{ projectId: string }> {
  const team = await getUserActiveTeam(supabase, userId);
  if (!team) {
    throw new Error("Vous devez appartenir à une équipe pour créer un projet.");
  }

  const admin = createAdminClient();
  const { data: project, error: projectError } = await admin
    .from("team_brain_projects")
    .insert({ team_id: team.teamId, name, emoji: emoji || "📁", created_by: userId })
    .select("id")
    .single();
  if (projectError || !project) {
    throw new Error("Impossible de créer le projet.");
  }

  const { error: memberError } = await admin
    .from("team_brain_project_members")
    .insert({ project_id: project.id, user_id: userId });
  if (memberError) {
    await admin.from("team_brain_projects").delete().eq("id", project.id as string);
    throw new Error("Impossible de vous ajouter au projet créé.");
  }

  return { projectId: project.id as string };
}
