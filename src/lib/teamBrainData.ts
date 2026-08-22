import type { SupabaseClient } from "@supabase/supabase-js";
import type { TeamBrainDoc, TeamBrainProject } from "@/lib/teamBrainMockData";

/**
 * Données réelles du Workspace/Projet Team Brain (étape 4/4) — remplace
 * teamBrainMockData pour les utilisateurs qui appartiennent réellement à
 * une équipe. Lu avec le client authentifié de session : RLS s'applique
 * nativement (voir tests/team-brain-rls.test.ts), sauf pour le trousseau de
 * l'équipe qui passe par team_brain_team_roster (voir supabase/schema.sql)
 * — un membre non admin ne peut pas lire team_members ni profiles au-delà
 * de sa propre ligne. Fichier sans dépendance serveur (pas de next/server,
 * pas de secret) : safe à importer depuis un composant "use client" (voir
 * colorForInitial, réutilisé par WorkspaceView.tsx).
 */

export interface TeamBrainWorkspaceData {
  teamName: string;
  memberCount: number;
  documentCount: number;
  projects: TeamBrainProject[];
  documentsByProject: Record<string, TeamBrainDoc[]>;
}

interface TeamRosterRow {
  user_id: string;
  email: string | null;
  status: string;
}

// Palette déterministe pour les avatars d'initiale unique (un seul
// caractère depuis l'email) — on n'a pas de couleur assignée par personne
// comme dans le mock : on en choisit une de façon stable à partir du
// caractère lui-même, pour que la même personne garde toujours la même
// couleur d'une carte à l'autre.
const AVATAR_COLORS = ["#b5693a", "#0c6b52", "#4b5d8b", "#6b4b8b", "#4b8b6b", "#8b4b6b"];
export function colorForInitial(initial: string): string {
  return AVATAR_COLORS[initial.charCodeAt(0) % AVATAR_COLORS.length];
}

function formatLastActivity(dateIso: string): string {
  const date = new Date(dateIso);
  const now = new Date();
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (isSameDay(date, now)) return "Aujourd'hui";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Hier";

  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date);
}

/** Équipe active de l'utilisateur — la première si plusieurs (pas de
 * sélecteur multi-équipes pour l'instant, voir plan validé). */
export async function getUserActiveTeam(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ teamId: string; teamName: string } | null> {
  const { data } = await supabase
    .from("team_members")
    .select("team_id, joined_at, teams(name)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const team = (Array.isArray(data.teams) ? data.teams[0] : data.teams) as { name: string } | null;
  if (!team) return null;

  return { teamId: data.team_id as string, teamName: team.name };
}

export async function getTeamWorkspaceData(
  supabase: SupabaseClient,
  teamId: string,
  teamName: string,
): Promise<TeamBrainWorkspaceData> {
  const { data: projects } = await supabase
    .from("team_brain_projects")
    .select("id, name, emoji, color, created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  const projectIds = (projects ?? []).map((p) => p.id as string);

  const [{ data: documents }, { data: projectMembers }, { data: roster }] = await Promise.all([
    supabase
      .from("team_brain_documents")
      .select("id, project_id, name, doc_type, added_by, is_private, page_count, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false }),
    projectIds.length > 0
      ? supabase.from("team_brain_project_members").select("project_id, user_id").in("project_id", projectIds)
      : Promise.resolve({ data: [] as { project_id: string; user_id: string }[] }),
    supabase.rpc("team_brain_team_roster", { p_team_id: teamId }),
  ]);

  const rosterRows = (roster ?? []) as TeamRosterRow[];
  const emailByUserId = new Map<string, string>();
  for (const member of rosterRows) {
    if (member.email) emailByUserId.set(member.user_id, member.email);
  }
  const initialFor = (userId: string) => (emailByUserId.get(userId)?.[0] ?? "?").toUpperCase();

  const docsByProject = new Map<string, { count: number; lastActivity: string | null }>();
  const documentsByProject: Record<string, TeamBrainDoc[]> = {};
  for (const doc of documents ?? []) {
    const projectId = doc.project_id as string;
    const createdAt = doc.created_at as string;

    const entry = docsByProject.get(projectId) ?? { count: 0, lastActivity: null };
    entry.count += 1;
    if (!entry.lastActivity || createdAt > entry.lastActivity) entry.lastActivity = createdAt;
    docsByProject.set(projectId, entry);

    const email = emailByUserId.get(doc.added_by as string) ?? "Membre retiré";
    const initial = initialFor(doc.added_by as string);
    const list = documentsByProject[projectId] ?? [];
    list.push({
      id: doc.id as string,
      name: doc.name as string,
      type: doc.doc_type as TeamBrainDoc["type"],
      addedBy: email,
      initials: initial,
      avatarColor: colorForInitial(initial),
      date: formatLastActivity(createdAt),
      pages: (doc.page_count as number | null) ?? 1,
      private: doc.is_private as boolean,
    });
    documentsByProject[projectId] = list;
  }

  const membersByProject = new Map<string, string[]>();
  for (const pm of projectMembers ?? []) {
    const list = membersByProject.get(pm.project_id as string) ?? [];
    list.push(initialFor(pm.user_id as string));
    membersByProject.set(pm.project_id as string, list);
  }

  const realProjects: TeamBrainProject[] = (projects ?? []).map((p) => {
    const docInfo = docsByProject.get(p.id as string);
    return {
      id: p.id as string,
      name: p.name as string,
      emoji: (p.emoji as string) || "📁",
      color: (p.color as string) || "#4b5d8b",
      docs: docInfo?.count ?? 0,
      lastActivity: docInfo?.lastActivity ? formatLastActivity(docInfo.lastActivity) : "Aucune activité",
      members: membersByProject.get(p.id as string) ?? [],
    };
  });

  return {
    teamName,
    memberCount: rosterRows.filter((m) => m.status === "active").length,
    documentCount: documents?.length ?? 0,
    projects: realProjects,
    documentsByProject,
  };
}
