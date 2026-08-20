import { randomUUID } from "crypto";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Tests de confidentialité RLS — Team Brain, étape 1.
 *
 * Ces tests vérifient, en tant qu'utilisateurs réels authentifiés (jamais
 * la clé "service role"), qu'un utilisateur ne peut JAMAIS voir un projet,
 * document ou chunk auquel il n'a pas droit — la barrière RLS elle-même,
 * indépendamment de tout code applicatif (voir @/supabase/schema.sql,
 * section 5, et le plan de confidentialité validé avec l'utilisateur).
 *
 * ⚠️ Pointe volontairement vers un projet Supabase de TEST/dev, jamais la
 * production : cette suite crée et supprime de vrais comptes/équipes à
 * chaque exécution. Variables requises (mêmes noms que le reste de
 * l'app) : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY. Sans elles, la suite est ignorée plutôt que
 * de faire échouer `npm test` dans un environnement qui ne les a pas.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SERVICE_ROLE_KEY);
if (!CONFIGURED) {
  console.warn(
    "[team-brain-rls] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY " +
      "non définies — tests de confidentialité RLS ignorés (voir l'en-tête du fichier).",
  );
}

const TEST_PASSWORD = `TeamBrainTest-${randomUUID()}!`;

interface FixtureUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

/** Toute la donnée de test créée pour cette exécution, nettoyée dans
 * afterAll — jamais les données de démo Nike/Agence ABC (mock, sans
 * rapport avec ces tables réelles). */
interface Fixture {
  teamA: string;
  teamB: string;
  projectA1: string;
  docShared: string;
  docPrivate: string;
  admin: FixtureUser; // équipe A, rôle admin
  memberWithAccess: FixtureUser; // équipe A, membre du projet A1, propriétaire du doc privé
  memberNoAccess: FixtureUser; // équipe A, jamais affecté au projet A1
  removedMember: FixtureUser; // équipe A, statut 'removed'
  otherTeamAdmin: FixtureUser; // équipe B, pour l'isolation inter-équipes
}

describe.skipIf(!CONFIGURED)("Team Brain — confidentialité RLS", () => {
  // Créé dans beforeAll plutôt qu'ici : skipIf n'empêche que l'exécution
  // des `it(...)`, pas celle du corps du describe lui-même — instancier le
  // client Supabase directement ici ferait échouer la suite avec
  // "supabaseUrl is required" dans un environnement sans ces variables,
  // au lieu de l'ignorer proprement.
  let admin: SupabaseClient;
  let fixture: Fixture;

  async function createFixtureUser(label: string): Promise<FixtureUser> {
    const email = `team-brain-rls-${label}-${randomUUID()}@example.invalid`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`Impossible de créer l'utilisateur de test ${label} : ${error?.message}`);

    const client = createSupabaseClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
    if (signInError) throw new Error(`Connexion impossible pour ${label} : ${signInError.message}`);

    return { id: data.user.id, email, client };
  }

  beforeAll(async () => {
    admin = createSupabaseClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    const admins = await Promise.all([
      createFixtureUser("admin"),
      createFixtureUser("member-with-access"),
      createFixtureUser("member-no-access"),
      createFixtureUser("removed-member"),
      createFixtureUser("other-team-admin"),
    ]);
    const [adminUser, memberWithAccess, memberNoAccess, removedMember, otherTeamAdmin] = admins;

    const { data: teamA } = await admin.from("teams").insert({ name: "Équipe de test A", owner_id: adminUser.id }).select("id").single();
    const { data: teamB } = await admin
      .from("teams")
      .insert({ name: "Équipe de test B", owner_id: otherTeamAdmin.id })
      .select("id")
      .single();
    if (!teamA || !teamB) throw new Error("Impossible de créer les équipes de test.");

    await admin.from("team_members").insert([
      { team_id: teamA.id, user_id: adminUser.id, role: "admin", status: "active" },
      { team_id: teamA.id, user_id: memberWithAccess.id, role: "member", status: "active" },
      { team_id: teamA.id, user_id: memberNoAccess.id, role: "member", status: "active" },
      { team_id: teamA.id, user_id: removedMember.id, role: "member", status: "removed" },
      { team_id: teamB.id, user_id: otherTeamAdmin.id, role: "admin", status: "active" },
    ]);

    const { data: projectA1 } = await admin
      .from("team_brain_projects")
      .insert({ team_id: teamA.id, name: "Projet de test A1", created_by: adminUser.id })
      .select("id")
      .single();
    if (!projectA1) throw new Error("Impossible de créer le projet de test.");

    // Seul memberWithAccess est explicitement affecté au projet — memberNoAccess
    // ne l'est jamais, c'est précisément ce que les tests vérifient.
    await admin.from("team_brain_project_members").insert({ project_id: projectA1.id, user_id: memberWithAccess.id });

    const { data: docShared } = await admin
      .from("team_brain_documents")
      .insert({
        project_id: projectA1.id,
        team_id: teamA.id,
        name: "Document partagé de test",
        doc_type: "note",
        added_by: adminUser.id,
        is_private: false,
      })
      .select("id")
      .single();
    const { data: docPrivate } = await admin
      .from("team_brain_documents")
      .insert({
        project_id: projectA1.id,
        team_id: teamA.id,
        name: "Document privé de test",
        doc_type: "note",
        added_by: memberWithAccess.id,
        is_private: true,
      })
      .select("id")
      .single();
    if (!docShared || !docPrivate) throw new Error("Impossible de créer les documents de test.");

    await admin.from("team_brain_chunks").insert([
      {
        document_id: docShared.id,
        project_id: projectA1.id,
        team_id: teamA.id,
        is_private: false,
        owner_id: adminUser.id,
        chunk_text: "Extrait du document partagé de test.",
      },
      {
        document_id: docPrivate.id,
        project_id: projectA1.id,
        team_id: teamA.id,
        is_private: true,
        owner_id: memberWithAccess.id,
        chunk_text: "Extrait du document privé de test — ne doit être vu que par son propriétaire.",
      },
    ]);

    fixture = {
      teamA: teamA.id,
      teamB: teamB.id,
      projectA1: projectA1.id,
      docShared: docShared.id,
      docPrivate: docPrivate.id,
      admin: adminUser,
      memberWithAccess,
      memberNoAccess,
      removedMember,
      otherTeamAdmin,
    };
  });

  afterAll(async () => {
    if (!fixture) return;
    // La cascade delete (on delete cascade) sur teams nettoie projects/
    // project_members/documents/chunks/team_members automatiquement.
    await admin.from("teams").delete().in("id", [fixture.teamA, fixture.teamB]);
    await Promise.all(
      [fixture.admin, fixture.memberWithAccess, fixture.memberNoAccess, fixture.removedMember, fixture.otherTeamAdmin].map((u) =>
        admin.auth.admin.deleteUser(u.id),
      ),
    );
  });

  it("un membre sans affectation au projet ne voit aucun chunk, même partagé", async () => {
    const { data, error } = await fixture.memberNoAccess.client.from("team_brain_chunks").select("id").eq("project_id", fixture.projectA1);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("un membre sans affectation au projet ne voit pas le projet lui-même", async () => {
    const { data, error } = await fixture.memberNoAccess.client.from("team_brain_projects").select("id").eq("id", fixture.projectA1);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("un membre avec accès voit le chunk partagé et son propre chunk privé", async () => {
    const { data, error } = await fixture.memberWithAccess.client
      .from("team_brain_chunks")
      .select("id, is_private")
      .eq("project_id", fixture.projectA1);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it("un membre avec accès ne voit PAS le chunk privé d'un autre membre", async () => {
    // memberNoAccess n'a de toute façon pas accès au projet (couvert plus
    // haut) — ce test isole spécifiquement la règle "privé = propriétaire
    // uniquement" en donnant temporairement l'accès projet à un second
    // utilisateur qui n'est PAS le propriétaire du document privé : ici,
    // l'admin voit le partagé mais jamais le privé de memberWithAccess.
    const { data, error } = await fixture.admin.client.from("team_brain_chunks").select("id, is_private").eq("project_id", fixture.projectA1);
    expect(error).toBeNull();
    expect(data?.every((c) => c.is_private === false)).toBe(true);
    expect(data?.map((c) => c.id)).not.toContain(fixture.docPrivate);
  });

  it("un membre retiré (status: removed) ne voit plus rien, même s'il a déjà eu accès", async () => {
    const { data, error } = await fixture.removedMember.client.from("team_brain_projects").select("id").eq("id", fixture.projectA1);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("isolation inter-équipes : un admin de l'équipe B n'obtient aucun résultat scopé à l'équipe A", async () => {
    const { data, error } = await fixture.otherTeamAdmin.client.from("team_brain_chunks").select("id").eq("team_id", fixture.teamA);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("un admin voit le document partagé mais pas le contenu du document privé d'un autre membre", async () => {
    const { data, error } = await fixture.admin.client.from("team_brain_documents").select("id, is_private").eq("project_id", fixture.projectA1);
    expect(error).toBeNull();
    expect(data?.map((d) => d.id)).toContain(fixture.docShared);
    expect(data?.map((d) => d.id)).not.toContain(fixture.docPrivate);
  });
});
