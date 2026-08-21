import { NextResponse } from "next/server";
import { getUserAndProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  extractPdfPages,
  fetchTeamBrainPdfFromBlob,
  indexTeamBrainDocument,
  type SourcePage,
} from "@/lib/teamBrainIndexing";

export const maxDuration = 120;

interface CreateDocumentBody {
  projectId?: string;
  name?: string;
  docType?: "note" | "pdf" | "doc";
  isPrivate?: boolean;
  text?: string;
  pdfUrl?: string;
}

/** Ajoute un document à un projet Team Brain et l'indexe (étape 2/4).
 * L'autorisation repose sur la même barrière qu'à l'étape 1 : la lecture
 * de team_brain_projects passe par le client authentifié (RLS), donc un
 * utilisateur sans accès au projet reçoit `null` ici — jamais besoin de
 * dupliquer la logique de team_brain_can_access_project côté application.
 * L'écriture, elle, passe par la clé service_role une fois l'accès
 * confirmé, comme partout ailleurs dans l'app. */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const body = (await request.json()) as CreateDocumentBody;
  const { projectId, name, docType, isPrivate, text, pdfUrl } = body;

  if (!projectId || !name || !docType || !["note", "pdf", "doc"].includes(docType)) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (docType === "note" && !text?.trim()) {
    return NextResponse.json({ error: "Le contenu de la note est vide." }, { status: 400 });
  }
  if ((docType === "pdf" || docType === "doc") && !pdfUrl) {
    return NextResponse.json({ error: "Aucun fichier téléversé." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("team_brain_projects")
    .select("id, team_id")
    .eq("id", projectId)
    .single();
  if (!project) {
    return NextResponse.json({ error: "Projet introuvable ou accès refusé." }, { status: 403 });
  }

  let pages: SourcePage[];
  let pageCount: number | null = null;
  let storagePath: string | null = null;

  try {
    if (docType === "note") {
      pages = [{ pageNumber: null, text: text! }];
    } else {
      const buffer = await fetchTeamBrainPdfFromBlob(pdfUrl!);
      pages = await extractPdfPages(buffer);
      pageCount = pages.length;
      storagePath = pdfUrl!;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de lire le fichier fourni.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: document, error: insertError } = await admin
    .from("team_brain_documents")
    .insert({
      project_id: projectId,
      team_id: project.team_id,
      name,
      doc_type: docType,
      storage_path: storagePath,
      added_by: auth.user.id,
      is_private: Boolean(isPrivate),
      page_count: pageCount,
    })
    .select("id")
    .single();

  if (insertError || !document) {
    console.error("Impossible de créer le document Team Brain :", insertError);
    return NextResponse.json({ error: "Impossible de créer le document." }, { status: 500 });
  }

  try {
    const { chunkCount } = await indexTeamBrainDocument({
      documentId: document.id,
      teamId: project.team_id,
      projectId,
      isPrivate: Boolean(isPrivate),
      ownerId: auth.user.id,
      pages,
    });
    return NextResponse.json({ documentId: document.id, chunkCount });
  } catch (error) {
    console.error("Erreur lors de l'indexation du document Team Brain :", error);
    // Le document existe déjà sans aucun chunk indexé — inutilisable pour
    // la recherche, on le supprime plutôt que de laisser un document
    // fantôme dans l'équipe.
    await admin.from("team_brain_documents").delete().eq("id", document.id);
    return NextResponse.json({ error: "L'indexation du document a échoué. Réessayez." }, { status: 500 });
  }
}
