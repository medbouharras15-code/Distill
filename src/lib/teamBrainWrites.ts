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
