import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase "service role" : contourne les policies RLS.
 *
 * ⚠️ Server-only. Ce fichier ne doit jamais être importé depuis un composant
 * "use client" ni depuis du code exécuté dans le navigateur — la clé
 * SUPABASE_SERVICE_ROLE_KEY donne un accès total à la base de données.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
