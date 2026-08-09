import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Utilisateur + profil courant côté serveur, ou `null` si non connecté.
 * Utilise le client authentifié (protégé par les policies RLS) : chaque
 * utilisateur ne peut lire que sa propre ligne de la table `profiles`. */
export async function getUserAndProfile() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return { user, profile: profile as Profile };
}
