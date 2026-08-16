import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getUserAndProfile } from "@/lib/auth";
import { MAX_PDF_FILE_BYTES } from "@/lib/fileSizeLimits";

/** Émet le jeton d'upload direct navigateur → Vercel Blob pour les PDF (voir
 * @/components/notes/AiPanel, qui appelle `upload()` avec `handleUploadUrl:
 * "/api/upload/pdf"`). Le fichier ne transite jamais par cette route ni par
 * /api/distill : seule une référence (URL) leur parvient ensuite. Protégée
 * par la même vérification d'auth que le reste de l'IA — sans compte, pas de
 * jeton, donc pas d'upload possible. */
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
