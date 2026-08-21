import { get } from "@vercel/blob";
import { getDocumentProxy, extractText } from "unpdf";
import { MAX_PDF_FILE_BYTES } from "@/lib/fileSizeLimits";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Pipeline d'indexation Team Brain (étape 2/4, voir plan validé) : découpe
 * un document en morceaux ("chunks"), génère leurs embeddings via Voyage AI,
 * et les écrit dans team_brain_chunks avec les colonnes dénormalisées
 * (team_id/project_id/is_private/owner_id) exigées par les policies RLS
 * testées à l'étape 1 (voir tests/team-brain-rls.test.ts). Server-only :
 * importe createAdminClient (clé service_role).
 */

const VOYAGE_MODEL = "voyage-4-lite";
// Doit rester aligné avec `embedding vector (1024)` dans
// supabase/schema.sql — passé explicitement plutôt que de dépendre de la
// valeur par défaut du modèle, qui pourrait changer côté Voyage.
const VOYAGE_OUTPUT_DIMENSION = 1024;
const VOYAGE_BATCH_SIZE = 100;

const CHUNK_SIZE_CHARS = 1500;
const CHUNK_OVERLAP_CHARS = 200;

export interface SourcePage {
  pageNumber: number | null;
  text: string;
}

export interface TextChunk {
  text: string;
  pageNumber: number | null;
}

/** Découpe le texte de chaque page en morceaux d'une taille raisonnable
 * pour la recherche, avec un léger chevauchement pour ne pas couper une
 * idée en deux entre deux chunks. Fonction pure, sans I/O — testable sans
 * réseau ni base de données. */
export function chunkPages(pages: SourcePage[]): TextChunk[] {
  const chunks: TextChunk[] = [];

  for (const page of pages) {
    const text = page.text.trim();
    if (!text) continue;

    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + CHUNK_SIZE_CHARS, text.length);
      chunks.push({ text: text.slice(start, end), pageNumber: page.pageNumber });
      if (end === text.length) break;
      start = end - CHUNK_OVERLAP_CHARS;
    }
  }

  return chunks;
}

/** Génère les embeddings d'une liste de textes via l'API Voyage AI, par
 * lots de VOYAGE_BATCH_SIZE pour rester sous les limites de l'API. Renvoie
 * les vecteurs dans le même ordre que `texts`. `input_type: "document"` :
 * Voyage recommande des embeddings asymétriques indexation/recherche —
 * l'étape 3 utilisera "query" côté recherche. */
export async function embedChunks(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY n'est pas configurée.");
  }

  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += VOYAGE_BATCH_SIZE) {
    const batch = texts.slice(i, i + VOYAGE_BATCH_SIZE);
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        input: batch,
        model: VOYAGE_MODEL,
        input_type: "document",
        output_dimension: VOYAGE_OUTPUT_DIMENSION,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Échec de la génération des embeddings Voyage (${response.status}) : ${body}`);
    }

    const json = (await response.json()) as { data: { embedding: number[]; index: number }[] };
    const batchEmbeddings = json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    results.push(...batchEmbeddings);
  }

  return results;
}

/** Télécharge un PDF Team Brain depuis Vercel Blob. Contrairement à
 * fetchPdfFromBlob (@/lib/distillServer, utilisé pour les résumés/QCM), le
 * fichier n'est jamais supprimé après usage : storage_path le référence
 * durablement comme document source de l'équipe. */
export async function fetchTeamBrainPdfFromBlob(url: string): Promise<ArrayBuffer> {
  const result = await get(url, { access: "private" });
  if (!result) {
    throw new Error("Le PDF téléversé est introuvable ou a expiré. Réessayez.");
  }

  const buffer = await new Response(result.stream).arrayBuffer();
  if (buffer.byteLength > MAX_PDF_FILE_BYTES) {
    throw new Error(`Le PDF est trop volumineux (${(MAX_PDF_FILE_BYTES / (1024 * 1024)).toFixed(0)} Mo maximum).`);
  }

  return buffer;
}

/** Extrait le texte d'un PDF, page par page (page_number sert ensuite à
 * citer la source précise d'un chunk). */
export async function extractPdfPages(buffer: ArrayBuffer): Promise<SourcePage[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  return pages.map((pageText, index) => ({ pageNumber: index + 1, text: pageText }));
}

export interface IndexDocumentParams {
  documentId: string;
  teamId: string;
  projectId: string;
  isPrivate: boolean;
  ownerId: string;
  pages: SourcePage[];
}

/** Orchestre le découpage, l'embedding et l'écriture des chunks d'un
 * document déjà créé dans team_brain_documents. Écrit via la clé
 * service_role, après que l'appelant (route API) a déjà vérifié
 * l'autorisation de l'utilisateur sur le projet — même principe que le
 * reste de l'application (RLS pour la lecture, vérification applicative +
 * service_role pour l'écriture). */
export async function indexTeamBrainDocument({
  documentId,
  teamId,
  projectId,
  isPrivate,
  ownerId,
  pages,
}: IndexDocumentParams): Promise<{ chunkCount: number }> {
  const chunks = chunkPages(pages);
  if (chunks.length === 0) {
    return { chunkCount: 0 };
  }

  const embeddings = await embedChunks(chunks.map((chunk) => chunk.text));

  const rows = chunks.map((chunk, i) => ({
    document_id: documentId,
    project_id: projectId,
    team_id: teamId,
    is_private: isPrivate,
    owner_id: ownerId,
    chunk_text: chunk.text,
    page_number: chunk.pageNumber,
    embedding: embeddings[i],
  }));

  const admin = createAdminClient();
  const { error } = await admin.from("team_brain_chunks").insert(rows);
  if (error) {
    throw new Error(`Échec de l'insertion des chunks : ${error.message}`);
  }

  return { chunkCount: rows.length };
}
