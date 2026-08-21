import { randomUUID } from "crypto";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chunkPages, indexTeamBrainDocument } from "@/lib/teamBrainIndexing";

/**
 * Tests du pipeline d'indexation Team Brain — étape 2/4.
 *
 * Deux parties : `chunkPages` est une fonction pure (aucune dépendance
 * réseau), toujours testée. Le reste (embeddings Voyage + écriture
 * Supabase) exige de vraies clés — voir tests/team-brain-rls.test.ts pour
 * le même principe de skip. Pointe vers le même projet Supabase de TEST,
 * jamais la production.
 *
 * Variables requises pour la partie intégration : NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, VOYAGE_API_KEY.
 */

describe("chunkPages", () => {
  it("découpe une page courte en un seul chunk", () => {
    const chunks = chunkPages([{ pageNumber: 1, text: "Un court extrait de cours." }]);
    expect(chunks).toEqual([{ text: "Un court extrait de cours.", pageNumber: 1 }]);
  });

  it("ignore les pages vides", () => {
    const chunks = chunkPages([
      { pageNumber: 1, text: "   " },
      { pageNumber: 2, text: "Contenu réel." },
    ]);
    expect(chunks).toEqual([{ text: "Contenu réel.", pageNumber: 2 }]);
  });

  it("découpe un texte long en plusieurs chunks avec chevauchement, en conservant le numéro de page", () => {
    const longText = "Phrase de test répétée. ".repeat(200); // largement > 1500 caractères
    const chunks = chunkPages([{ pageNumber: 3, text: longText }]);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.pageNumber === 3)).toBe(true);
    // Les 200 derniers caractères de chaque chunk (sauf le dernier) doivent
    // ouvrir le chunk suivant : c'est le chevauchement voulu (CHUNK_OVERLAP_CHARS
    // dans teamBrainIndexing.ts), pas un bug.
    for (let i = 0; i < chunks.length - 1; i++) {
      const overlapFromCurrent = chunks[i].text.slice(-200);
      expect(chunks[i + 1].text.startsWith(overlapFromCurrent)).toBe(true);
    }
  });
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

const CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SERVICE_ROLE_KEY && VOYAGE_API_KEY);
if (!CONFIGURED) {
  console.warn(
    "[team-brain-indexing] Identifiants Supabase et/ou VOYAGE_API_KEY non définis — " +
      "tests d'intégration du pipeline d'indexation ignorés (voir l'en-tête du fichier).",
  );
}

const TEST_PASSWORD = `TeamBrainIndexTest-${randomUUID()}!`;

describe.skipIf(!CONFIGURED)("indexTeamBrainDocument — intégration", () => {
  // Voir tests/team-brain-rls.test.ts : le client est créé dans beforeAll,
  // jamais au niveau du describe, pour que skipIf ignore proprement la
  // suite sans lever d'erreur dans un environnement non configuré.
  let admin: SupabaseClient;
  let userId: string;
  let teamId: string;
  let projectId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const email = `team-brain-index-${randomUUID()}@example.invalid`;
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (userError || !userData.user) throw new Error(`Impossible de créer l'utilisateur de test : ${userError?.message}`);
    userId = userData.user.id;

    const { data: team } = await admin.from("teams").insert({ name: "Équipe de test indexation", owner_id: userId }).select("id").single();
    if (!team) throw new Error("Impossible de créer l'équipe de test.");
    teamId = team.id;

    await admin.from("team_members").insert({ team_id: teamId, user_id: userId, role: "admin", status: "active" });

    const { data: project } = await admin
      .from("team_brain_projects")
      .insert({ team_id: teamId, name: "Projet de test indexation", created_by: userId })
      .select("id")
      .single();
    if (!project) throw new Error("Impossible de créer le projet de test.");
    projectId = project.id;
  });

  afterAll(async () => {
    if (!teamId) return;
    await admin.from("teams").delete().eq("id", teamId); // cascade sur projects/documents/chunks/team_members
    await admin.auth.admin.deleteUser(userId);
  });

  it("indexe une note texte : crée les chunks attendus, avec embedding et colonnes dénormalisées correctes", async () => {
    const { data: document } = await admin
      .from("team_brain_documents")
      .insert({
        project_id: projectId,
        team_id: teamId,
        name: "Note de test",
        doc_type: "note",
        added_by: userId,
        is_private: true,
      })
      .select("id")
      .single();
    if (!document) throw new Error("Impossible de créer le document de test.");

    const noteText = "Phrase de test pour vérifier le pipeline d'indexation Team Brain. ".repeat(80);
    const { chunkCount } = await indexTeamBrainDocument({
      documentId: document.id,
      teamId,
      projectId,
      isPrivate: true,
      ownerId: userId,
      pages: [{ pageNumber: null, text: noteText }],
    });

    expect(chunkCount).toBeGreaterThan(0);

    const { data: chunks, error } = await admin
      .from("team_brain_chunks")
      .select("document_id, project_id, team_id, is_private, owner_id, embedding, chunk_text")
      .eq("document_id", document.id);

    expect(error).toBeNull();
    expect(chunks).toHaveLength(chunkCount);
    for (const chunk of chunks!) {
      expect(chunk.project_id).toBe(projectId);
      expect(chunk.team_id).toBe(teamId);
      expect(chunk.is_private).toBe(true);
      expect(chunk.owner_id).toBe(userId);
      expect(chunk.chunk_text.length).toBeGreaterThan(0);

      // pgvector renvoie le vecteur sous forme de chaîne "[0.1,0.2,...]" via
      // supabase-js — on vérifie la dimension plutôt que le type exact.
      const embeddingValues = JSON.parse(chunk.embedding as unknown as string) as number[];
      expect(embeddingValues).toHaveLength(1024);
    }
  });
});
