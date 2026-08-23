import { NextResponse } from "next/server";
import { getUserAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createTeam } from "@/lib/teamBrainWrites";

interface CreateTeamBody {
  name?: string;
}

/** Crée une équipe Team Brain et son créateur comme admin actif (voir
 * @/lib/teamBrainWrites). Auth requise ; le reste de l'autorisation
 * (pas déjà membre d'une équipe) est vérifié dans createTeam. */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const body = (await request.json()) as CreateTeamBody;
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Donnez un nom à votre équipe." }, { status: 400 });
  }

  const supabase = await createClient();
  try {
    const { teamId } = await createTeam(supabase, auth.user.id, name);
    return NextResponse.json({ teamId });
  } catch (error) {
    console.error("Erreur lors de la création de l'équipe Team Brain :", error);
    const message = error instanceof Error ? error.message : "Impossible de créer l'équipe.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
