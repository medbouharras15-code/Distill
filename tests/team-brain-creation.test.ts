import { randomUUID } from "crypto";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createProject, createTeam } from "@/lib/teamBrainWrites";

/**
 * Tests de création d'équipe/projet Team Brain (chantier séparé de
 * l'étape 4, "création d'équipe et de projet en interface" — étapes A/B).
 *
 * Contrairement aux tests précédents, il ne s'agit pas de vérifier des
 * policies RLS (ces 4 tables n'en ont aucune en écriture, voir
 * supabase/schema.sql et @/lib/teamBrainWrites) mais la logique
 * d'autorisation applicative de createTeam/createProject elle-même : le
 * créateur devient bien admin actif / membre du projet créé, et les cas
 * refusés (deuxième équipe, projet sans équipe) le sont bien. Même
 * principe de skip que les suites précédentes.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SERVICE_ROLE_KEY);
if (!CONFIGURED) {
  console.warn(
    "[team-brain-creation] Identifiants Supabase non définis — tests de création d'équipe ignorés (voir l'en-tête du fichier).",
  );
}

const TEST_PASSWORD = `TeamBrainCreateTest-${randomUUID()}!`;

describe.skipIf(!CONFIGURED)("createTeam", () => {
  // Voir tests/team-brain-rls.test.ts : tout est créé dans beforeAll,
  // jamais au niveau du describe, pour que skipIf ignore proprement la
  // suite sans lever d'erreur dans un environnement non configuré.
  let admin: SupabaseClient;
  let userClient: SupabaseClient;
  let userId: string;
  let createdTeamIds: string[] = [];

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const email = `team-brain-create-${randomUUID()}@example.invalid`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`Impossible de créer l'utilisateur de test : ${error?.message}`);
    userId = data.user.id;

    userClient = createSupabaseClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { error: signInError } = await userClient.auth.signInWithPassword({ email, password: TEST_PASSWORD });
    if (signInError) throw new Error(`Connexion impossible pour l'utilisateur de test : ${signInError.message}`);
  });

  afterEach(async () => {
    if (createdTeamIds.length === 0) return;
    await admin.from("teams").delete().in("id", createdTeamIds); // cascade sur team_members
    createdTeamIds = [];
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("crée une équipe et rend le créateur admin actif", async () => {
    const { teamId } = await createTeam(userClient, userId, "Équipe de test création");
    createdTeamIds.push(teamId);

    const { data: membership } = await admin
      .from("team_members")
      .select("role, status")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .single();

    expect(membership?.role).toBe("admin");
    expect(membership?.status).toBe("active");
  });

  it("refuse de créer une deuxième équipe pour un utilisateur qui en a déjà une", async () => {
    const { teamId } = await createTeam(userClient, userId, "Première équipe");
    createdTeamIds.push(teamId);

    await expect(createTeam(userClient, userId, "Deuxième équipe")).rejects.toThrow();
  });
});

describe.skipIf(!CONFIGURED)("createProject", () => {
  let admin: SupabaseClient;
  let userClient: SupabaseClient;
  let userId: string;
  let teamId: string;
  let createdProjectIds: string[] = [];

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const email = `team-brain-create-project-${randomUUID()}@example.invalid`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`Impossible de créer l'utilisateur de test : ${error?.message}`);
    userId = data.user.id;

    userClient = createSupabaseClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { error: signInError } = await userClient.auth.signInWithPassword({ email, password: TEST_PASSWORD });
    if (signInError) throw new Error(`Connexion impossible pour l'utilisateur de test : ${signInError.message}`);

    const { teamId: newTeamId } = await createTeam(userClient, userId, "Équipe de test création de projet");
    teamId = newTeamId;
  });

  afterEach(async () => {
    if (createdProjectIds.length === 0) return;
    await admin.from("team_brain_projects").delete().in("id", createdProjectIds); // cascade sur team_brain_project_members
    createdProjectIds = [];
  });

  afterAll(async () => {
    if (teamId) await admin.from("teams").delete().eq("id", teamId);
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("crée un projet dans l'équipe active et y ajoute automatiquement son créateur", async () => {
    const { projectId } = await createProject(userClient, userId, "Projet de test");
    createdProjectIds.push(projectId);

    const { data: membership } = await admin
      .from("team_brain_project_members")
      .select("user_id")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle();

    expect(membership).not.toBeNull();
  });

  it("refuse de créer un projet pour un utilisateur sans équipe active", async () => {
    const email = `team-brain-create-project-noteam-${randomUUID()}@example.invalid`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`Impossible de créer l'utilisateur de test : ${error?.message}`);

    const client = createSupabaseClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
    if (signInError) throw new Error(`Connexion impossible pour l'utilisateur de test : ${signInError.message}`);

    await expect(createProject(client, data.user.id, "Projet orphelin")).rejects.toThrow();

    await admin.auth.admin.deleteUser(data.user.id);
  });
});
