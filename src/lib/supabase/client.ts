import { createBrowserClient } from "@supabase/ssr";

/** Client Supabase pour le navigateur (composants "use client"). Utilise la
 * clé publique "anon" : les droits d'accès sont limités par les policies
 * RLS définies dans supabase/schema.sql. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
