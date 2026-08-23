import { NextResponse } from "next/server";
import { getUserAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createProject } from "@/lib/teamBrainWrites";

interface CreateProjectBody {
  name?: string;
  emoji?: string;
}

/** Crée un projet Team Brain dans l'équipe active de l'utilisateur (voir
 * @/lib/teamBrainWrites). Auth requise ; l'équipe elle-même n'est jamais
 * fournie par le client, toujours dérivée de la session. */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const body = (await request.json()) as CreateProjectBody;
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Donnez un nom à votre projet." }, { status: 400 });
  }

  const supabase = await createClient();
  try {
    const { projectId } = await createProject(supabase, auth.user.id, name, body.emoji?.trim());
    return NextResponse.json({ projectId });
  } catch (error) {
    console.error("Erreur lors de la création du projet Team Brain :", error);
    const message = error instanceof Error ? error.message : "Impossible de créer le projet.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
