import { defineConfig } from "vitest/config";

/** Config minimale — pour l'instant uniquement les tests de confidentialité
 * RLS de Team Brain (voir tests/team-brain-rls.test.ts), qui tournent en
 * environnement Node (appels réseau vers Supabase, pas de DOM). */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
