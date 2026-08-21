import { randomUUID } from "crypto";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { indexTeamBrainDocument } from "@/lib/teamBrainIndexing";
import { embedQuery, searchTeamBrainChunks } from "@/lib/teamBrainSearch";

/**
 * Tests de confidentialité de la recherche Team Brain — étape 3/4.
 *
 * Même principe que tests/team-brain-rls.test.ts (étape 1) et
 * tests/team-brain-indexing.test.ts (étape 2), appliqué cette fois à
 * team_brain_match_chunks : vérifie qu'une recherche par similarité
 * n'expose jamais un résultat que les policies RLS interdiraient en
 * lecture directe (voir supabase/schema.sql — la fonction est "security
 * invoker", pas "definer", précisément pour ça). Comme le corpus de test
 * ne contient que deux chunks, on vérifie l'ENSEMBLE des résultats plutôt
 * que leur ordre de pertinence : peu importe lequel des deux Voyage juge
 * le plus proche de la question, seule compte la présence/absence du
 * chunk privé selon qui interroge.
 *
 * Ignoré sans identifiants Supabase ET une clé Voyage (l'indexation du
 * corpus de test exige de vrais embeddings, pas seulement une lecture).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

const CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SERVICE_ROLE_KEY && VOYAGE_API_KEY);
if (!CONFIGURED) {
  console.warn(
    "[team-brain-search] Identifiants Supabase et/ou VOYAGE_API_KEY non définis — " +
      "tests de confidentialité de la recherche ignorés (voir l'en-tête du fichier).",
  );
}

const TEST_PASSWORD = `TeamBrainSearchTest-${randomUUID()}!`;

interface FixtureUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

describe.skipIf(!CONFIGURED)("team_brain_match_chunks — confidentialité", () => {
  // Voir tests/team-brain-rls.test.ts : tout est créé dans beforeAll, jamais
  // au niveau du describe, pour que skipIf ignore proprement la suite sans
  // lever d'erreur dans un environnement non configuré.
  let admin: SupabaseClient;
  let teamId: string;
  let otherTeamId: string;
  let projectId: string;
  let sharedDocumentId: string;
  let privateDocumentId: string;
  let queryEmbedding: number[];
  let memberWithAccess: FixtureUser;
  let memberNoAccess: FixtureUser;
  let adminNotOwner: FixtureUser;
  let otherTeamAdmin: FixtureUser;

  async function createFixtureUser(label: string): Promise<FixtureUser> {
    const email = `team-brain-search-${label}-${randomUUID()}@example.invalid`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`Impossible de créer l'utilisateur de test ${label} : ${error?.message}`);

    const client = createSupabaseClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
    if (signInError) throw new Error(`Connexion impossible pour ${label} : ${signInError.message}`);

    return { id: data.user.id, email, client };
  }

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    [memberWithAccess, memberNoAccess, adminNotOwner, otherTeamAdmin] = await Promise.all([
      createFixtureUser("member-with-access"),
      createFixtureUser("member-no-access"),
      createFixtureUser("admin-not-owner"),
      createFixtureUser("other-team-admin"),
    ]);

    const { data: team } = await admin
      .from("teams")
      .insert({ name: "Équipe de test recherche", owner_id: memberWithAccess.id })
      .select("id")
      .single();
    const { data: otherTeam } = await admin
      .from("teams")
      .insert({ name: "Autre équipe", owner_id: otherTeamAdmin.id })
      .select("id")
      .single();
    if (!team || !otherTeam) throw new Error("Impossible de créer les équipes de test.");
    teamId = team.id;
    otherTeamId = otherTeam.id;

    await admin.from("team_members").insert([
      { team_id: teamId, user_id: memberWithAccess.id, role: "member", status: "active" },
      { team_id: teamId, user_id: memberNoAccess.id, role: "member", status: "active" },
      { team_id: teamId, user_id: adminNotOwner.id, role: "admin", status: "active" },
      { team_id: otherTeamId, user_id: otherTeamAdmin.id, role: "admin", status: "active" },
    ]);

    const { data: project } = await admin
      .from("team_brain_projects")
      .insert({ team_id: teamId, name: "Projet de test recherche", created_by: memberWithAccess.id })
      .select("id")
      .single();
    if (!project) throw new Error("Impossible de créer le projet de test.");
    projectId = project.id;

    // Seul memberWithAccess est explicitement affecté au projet.
    // adminNotOwner y accède via son rôle admin (team_brain_can_access_project),
    // sans ligne dans team_brain_project_members — memberNoAccess, lui,
    // n'a ni l'un ni l'autre.
    await admin.from("team_brain_project_members").insert({ project_id: projectId, user_id: memberWithAccess.id });

    const { data: sharedDoc } = await admin
      .from("team_brain_documents")
      .insert({
        project_id: projectId,
        team_id: teamId,
        name: "Document partagé",
        doc_type: "note",
        added_by: memberWithAccess.id,
        is_private: false,
      })
      .select("id")
      .single();
    const { data: privateDoc } = await admin
      .from("team_brain_documents")
      .insert({
        project_id: projectId,
        team_id: teamId,
        name: "Document privé",
        doc_type: "note",
        added_by: memberWithAccess.id,
        is_private: true,
      })
      .select("id")
      .single();
    if (!sharedDoc || !privateDoc) throw new Error("Impossible de créer les documents de test.");
    sharedDocumentId = sharedDoc.id;
    privateDocumentId = privateDoc.id;

    await indexTeamBrainDocument({
      documentId: sharedDocumentId,
      teamId,
      projectId,
      isPrivate: false,
      ownerId: memberWithAccess.id,
      pages: [{ pageNumber: null, text: "Le lancement de la nouvelle collection est prévu pour le mois de mars." }],
    });
    await indexTeamBrainDocument({
      documentId: privateDocumentId,
      teamId,
      projectId,
      isPrivate: true,
      ownerId: memberWithAccess.id,
      pages: [{ pageNumber: null, text: "Le budget marketing confidentiel s'élève à quinze mille euros." }],
    });

    queryEmbedding = await embedQuery("Quelles sont les informations disponibles pour ce projet ?");
  });

  afterAll(async () => {
    if (!teamId) return;
    await admin.from("teams").delete().in("id", [teamId, otherTeamId]); // cascade sur projects/documents/chunks/team_members
    await Promise.all(
      [memberWithAccess, memberNoAccess, adminNotOwner, otherTeamAdmin].map((u) => admin.auth.admin.deleteUser(u.id)),
    );
  });

  it("un membre sans affectation au projet n'obtient aucun résultat", async () => {
    const results = await searchTeamBrainChunks(memberNoAccess.client, projectId, queryEmbedding);
    expect(results).toEqual([]);
  });

  it("isolation inter-équipes : un admin d'une autre équipe n'obtient aucun résultat", async () => {
    const results = await searchTeamBrainChunks(otherTeamAdmin.client, projectId, queryEmbedding);
    expect(results).toEqual([]);
  });

  it("le propriétaire du document privé voit les deux chunks (partagé + son propre privé)", async () => {
    const results = await searchTeamBrainChunks(memberWithAccess.client, projectId, queryEmbedding);
    const documentIds = results.map((r) => r.documentId).sort();
    expect(documentIds).toEqual([privateDocumentId, sharedDocumentId].sort());
  });

  it("un admin qui n'est pas le propriétaire voit le chunk partagé mais jamais le chunk privé d'autrui", async () => {
    const results = await searchTeamBrainChunks(adminNotOwner.client, projectId, queryEmbedding);
    const documentIds = results.map((r) => r.documentId);
    expect(documentIds).toContain(sharedDocumentId);
    expect(documentIds).not.toContain(privateDocumentId);
  });
});
