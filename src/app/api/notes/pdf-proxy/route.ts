import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getUserAndProfile } from "@/lib/auth";

/** Seules les URLs pointant réellement vers un store Vercel Blob sont
 * acceptées ici — jamais une URL externe arbitraire (cette route n'est pas
 * un proxy HTTP générique). Même restriction de nom d'hôte que celle
 * appliquée en interne par le SDK Vercel Blob lui-même (voir
 * node_modules/@vercel/blob/dist/index.js, fonction get()). */
function isVercelBlobUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/** Sert un PDF Notes importé (voir PdfPageLayer.tsx) au navigateur. Le
 * fichier reste "private" côté stockage (voir handleImportPdf dans
 * NotesPageClient.tsx) : un `fetch()` nu du navigateur sur son URL Blob est
 * refusé (le SDK Vercel Blob n'autorise la lecture d'un blob privé qu'avec
 * un jeton serveur, jamais exposé au client — voir get() ci-dessous, qui
 * ajoute lui-même un header Authorization). Cette route est donc le seul
 * point qui relit le blob, protégée par la même vérification d'auth que
 * /api/notes/pages — sans compte, aucun fichier n'est servi. */
export async function GET(request: Request) {
  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const url = new URL(request.url).searchParams.get("url");
  if (!url || !isVercelBlobUrl(url)) {
    return NextResponse.json({ error: "URL de PDF invalide." }, { status: 400 });
  }

  try {
    const result = await get(url, { access: "private" });
    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: "PDF introuvable." }, { status: 404 });
    }
    return new NextResponse(result.stream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Impossible de lire le PDF Notes :", err);
    return NextResponse.json({ error: "Impossible de lire le PDF." }, { status: 500 });
  }
}
