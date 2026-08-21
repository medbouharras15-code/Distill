import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

/** Config minimale — pour l'instant uniquement les tests Team Brain (voir
 * tests/team-brain-*.test.ts), qui tournent en environnement Node (appels
 * réseau vers Supabase/Voyage, pas de DOM). L'alias "@/" doit être redéclaré
 * ici : vitest ne lit pas automatiquement les "paths" de tsconfig.json. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Les tests d'intégration Team Brain font de vrais appels réseau
    // (Supabase, Voyage AI) et peuvent désormais réessayer sur une limite
    // de débit Voyage (voir VOYAGE_MAX_ATTEMPTS dans teamBrainIndexing.ts,
    // jusqu'à ~40s d'attente cumulée) — délais par défaut de vitest (5s/10s)
    // bien trop courts pour ça.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // Sans compte payant, Voyage AI limite à 3 requêtes/minute par compte
    // (voir VOYAGE_MAX_ATTEMPTS ci-dessus) — un plafond par COMPTE, pas par
    // fichier de test. Vitest exécute les fichiers en parallèle par défaut,
    // ce qui fait se chevaucher les appels de team-brain-indexing.test.ts
    // et team-brain-search.test.ts et sature la limite en continu, sans
    // jamais laisser la pause de nouvelle tentative faire effet. Fichiers
    // exécutés en séquence pour éviter ça — sans impact sur la durée totale
    // en usage normal (peu de fichiers, chacun déjà rapide).
    fileParallelism: false,
  },
});
