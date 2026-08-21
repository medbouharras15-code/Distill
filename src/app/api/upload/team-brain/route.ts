import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getUserAndProfile } from "@/lib/auth";
import { MAX_PDF_FILE_BYTES } from "@/lib/fileSizeLimits";

/** Émet le jeton d'upload direct navigateur → Vercel Blob pour les PDF
 * ajoutés à un projet Team Brain (voir @/app/api/team-brain/documents, qui
 * télécharge ensuite ce fichier pour l'indexer — pdfUrl référencé
 * durablement en storage_path, jamais supprimé comme pour /api/upload/pdf).
 * Même garde-fou qu'ailleurs : sans compte, pas de jeton. L'appartenance au
 * projet visé n'est vérifiée qu'à la création du document, pas ici — comme
 * pour /api/upload/pdf, un jeton émis sans document créé derrière reste un
 * fichier orphelin inoffensif. */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const auth = await getUserAndProfile();
        if (!auth) {
          throw new Error("Vous devez être connecté pour téléverser un fichier.");
        }

        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_PDF_FILE_BYTES,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Téléversement refusé." },
      { status: 400 },
    );
  }
}
