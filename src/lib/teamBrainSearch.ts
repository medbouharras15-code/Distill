import type { SupabaseClient } from "@supabase/supabase-js";
import { embedTexts } from "@/lib/teamBrainIndexing";

/**
 * Recherche Team Brain (étape 3/4, voir plan validé). Contrairement à
 * teamBrainIndexing.ts (écriture, client service_role), ce module lit via
 * le client authentifié de session — voir team_brain_match_chunks dans
 * supabase/schema.sql, volontairement "security invoker" pour hériter des
 * policies RLS déjà testées à l'étape 1 plutôt que de dupliquer la
 * vérification d'accès ici.
 */

const MATCH_COUNT = 8;

export interface MatchedChunk {
  chunkId: string;
  documentId: string;
  documentName: string;
  chunkText: string;
  pageNumber: number | null;
  similarity: number;
}

/** Transforme une question en vecteur ("query", asymétrique par rapport à
 * "document" utilisé à l'indexation — recommandation Voyage AI). */
export async function embedQuery(question: string): Promise<number[]> {
  const [embedding] = await embedTexts([question], "query");
  return embedding;
}

/** Cherche les chunks les plus pertinents pour une question, au sein d'un
 * projet. `supabase` DOIT être le client authentifié de session (jamais le
 * client service_role) : c'est ce qui fait respecter RLS à l'intérieur de
 * la fonction SQL appelée, donc la confidentialité déjà testée à l'étape 1
 * (document privé, membre retiré, isolation inter-équipes...). */
export async function searchTeamBrainChunks(
  supabase: SupabaseClient,
  projectId: string,
  queryEmbedding: number[],
): Promise<MatchedChunk[]> {
  const { data, error } = await supabase.rpc("team_brain_match_chunks", {
    p_project_id: projectId,
    p_query_embedding: queryEmbedding,
    p_match_count: MATCH_COUNT,
  });

  if (error) {
    throw new Error(`Échec de la recherche Team Brain : ${error.message}`);
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    chunkId: row.chunk_id as string,
    documentId: row.document_id as string,
    documentName: row.document_name as string,
    chunkText: row.chunk_text as string,
    pageNumber: row.page_number as number | null,
    similarity: row.similarity as number,
  }));
}
