import { NextResponse } from "next/server";
import { getUserAndProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ImageElement, PaperSize, ShapeElement, SheetType, Stroke, TextBoxElement } from "@/lib/notes/types";

interface NotePageContent {
  strokes: Stroke[];
  shapes: ShapeElement[];
  images: ImageElement[];
  textBoxes: TextBoxElement[];
}

interface NotePageRow {
  id: string;
  position: number;
  sheetType: SheetType;
  paperSize: PaperSize;
  backgroundColor: string;
  content: NotePageContent;
}

/** Garde-fou : une page ne devrait jamais approcher cette taille en usage
 * normal (quelques milliers de points par trait au pire) — rejette une
 * requête anormalement volumineuse plutôt que de la stocker sans limite. */
const MAX_CONTENT_BYTES = 5_000_000;

function isValidContent(value: unknown): value is NotePageContent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.strokes) && Array.isArray(v.shapes) && Array.isArray(v.images) && Array.isArray(v.textBoxes);
}

/** Liste les pages du carnet Notes de l'utilisateur connecté, triées par
 * position — voir NotesPageClient, qui les charge au montage pour un
 * visiteur connecté (un visiteur anonyme n'appelle jamais cette route,
 * l'éditeur reste alors purement en mémoire comme avant). */
export async function GET() {
  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("note_pages")
    .select("id, position, sheet_type, paper_size, background_color, content")
    .eq("user_id", auth.user.id)
    .order("position", { ascending: true });

  if (error) {
    console.error("Impossible de charger les pages Notes :", error);
    return NextResponse.json({ error: "Impossible de charger les pages." }, { status: 500 });
  }

  const pages: NotePageRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    position: row.position as number,
    sheetType: row.sheet_type as SheetType,
    paperSize: row.paper_size as PaperSize,
    backgroundColor: row.background_color as string,
    content: row.content as NotePageContent,
  }));

  return NextResponse.json({ pages });
}

/** Enregistre (crée ou met à jour) une page du carnet Notes — appelée par
 * l'autosauvegarde débouncée de NotesCanvas (voir onDocChange) à chaque
 * changement de contenu, une fois par page concernée. */
export async function PUT(request: Request) {
  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  let body: Partial<NotePageRow>;
  try {
    body = (await request.json()) as Partial<NotePageRow>;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (
    typeof body.id !== "string" ||
    body.id.trim().length === 0 ||
    typeof body.position !== "number" ||
    typeof body.sheetType !== "string" ||
    typeof body.paperSize !== "string" ||
    typeof body.backgroundColor !== "string" ||
    !isValidContent(body.content)
  ) {
    return NextResponse.json({ error: "Page invalide." }, { status: 400 });
  }

  if (JSON.stringify(body.content).length > MAX_CONTENT_BYTES) {
    return NextResponse.json({ error: "Page trop volumineuse." }, { status: 413 });
  }

  const admin = createAdminClient();

  // L'id est généré côté client (crypto.randomUUID()) : avant d'écrire, on
  // vérifie qu'une éventuelle ligne existante portant cet id appartient
  // bien à l'utilisateur courant — pour ne jamais laisser une requête
  // réutiliser (par erreur ou intentionnellement) l'id d'une page
  // appartenant à quelqu'un d'autre.
  const { data: existing } = await admin.from("note_pages").select("user_id").eq("id", body.id).maybeSingle();
  if (existing && existing.user_id !== auth.user.id) {
    return NextResponse.json({ error: "Cette page appartient à un autre utilisateur." }, { status: 403 });
  }

  const { error } = await admin.from("note_pages").upsert({
    id: body.id,
    user_id: auth.user.id,
    position: body.position,
    sheet_type: body.sheetType,
    paper_size: body.paperSize,
    background_color: body.backgroundColor,
    content: body.content,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Impossible d'enregistrer la page Notes :", error);
    return NextResponse.json({ error: "Impossible d'enregistrer la page." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
