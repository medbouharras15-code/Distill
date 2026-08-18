export interface Flashcard {
  question: string;
  answer: string;
}

export type QuizDifficulty = "easy" | "hard";

export interface QuizChoice {
  /** Identifiant stable de la proposition ("a", "b", "c"…), utilisé pour
   * relier les inputs radio/checkbox à `correctChoiceIds`. */
  id: string;
  text: string;
}

export interface QuizQuestion {
  question: string;
  /** 4 ou 5 propositions. */
  choices: QuizChoice[];
  /** Un seul id = choix unique (radio) ; deux ids ou plus = choix multiple
   * (checkbox). Le type n'est jamais demandé explicitement au modèle ni
   * affiché à l'étudiant avant qu'il ait lu les propositions — il se déduit
   * uniquement de la longueur de ce tableau. */
  correctChoiceIds: string[];
  explanation?: string;
}

/** Résultat équivalent généré par le modèle de comparaison (voir
 * @/lib/modelComparison) — même forme que le résultat principal, pour
 * affichage côte à côte. N'existe que lorsque le mode comparaison est actif
 * (Preview/dev) ET explicitement demandé pour cette génération. */
export interface DistillComparisonResult {
  model: string;
  summary: string;
  flashcards: Flashcard[];
}

export interface DistillResult {
  summary: string;
  flashcards: Flashcard[];
  /** Absent si l'étudiant n'a pas demandé de QCM lors de la génération. */
  quiz?: QuizQuestion[];
  /** Présent uniquement en mode comparaison de modèles. */
  comparison?: DistillComparisonResult;
  /** Message d'échec de la comparaison seule — n'affecte jamais `summary`/
   * `flashcards`, déjà générés avec succès par le modèle principal. */
  comparisonError?: string;
}

export interface DistillRequestFile {
  /** Données du fichier encodées en base64 (sans le préfixe "data:...;base64,") */
  data: string;
  /** Type MIME du fichier, ex. "image/png" ou "application/pdf" */
  mediaType: string;
}

/** Référence à un PDF déjà téléversé sur Vercel Blob par le navigateur (upload
 * direct, en dehors du corps de la requête) — voir @/lib/fileSizeLimits pour
 * le calcul de MAX_PDF_FILE_BYTES et @/app/api/upload/pdf pour l'émission du
 * jeton d'upload. Contrairement à l'image (toujours inline, voir
 * DistillRequestFile), le PDF n'est plus assez petit pour tenir dans le
 * corps de la requête une fois la limite portée à 15 Mo. */
export interface PdfBlobReference {
  url: string;
  mediaType: "application/pdf";
}

export interface DistillRequestBody {
  text?: string;
  image?: DistillRequestFile;
  pdf?: PdfBlobReference;
  /** Demande un second appel de comparaison (voir @/lib/modelComparison) —
   * sans effet si le mode n'est pas activé côté serveur (Preview/dev). */
  compareWithHaiku?: boolean;
}

/** Corps de la requête vers /api/distill/quiz — appel séparé de
 * /api/distill, lancé une fois le résumé/les flashcards déjà affichés (voir
 * @/components/notes/AiPanel). Même matière source (texte/photo/PDF) que le
 * premier appel, mais la difficulté est cette fois obligatoire. */
export interface QuizRequestBody {
  text?: string;
  image?: DistillRequestFile;
  pdf?: PdfBlobReference;
  quizDifficulty: QuizDifficulty;
  /** Voir DistillRequestBody.compareWithHaiku — même principe. */
  compareWithHaiku?: boolean;
}

/** Voir DistillComparisonResult — même principe pour le QCM. */
export interface QuizComparisonResult {
  model: string;
  quiz: QuizQuestion[];
}

export interface QuizGenerationResult {
  quiz: QuizQuestion[];
  comparison?: QuizComparisonResult;
  comparisonError?: string;
}

/** Citation d'un passage exact des notes sources, retournée par le modèle
 * à l'appui d'une réponse du Mode Explication (voir /api/distill/chat).
 * `quote` doit être un extrait mot pour mot du texte source — recherché
 * côté client comme sous-chaîne exacte pour un éventuel surlignage. */
export interface ChatCitation {
  quote: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Toujours vide côté "user" ; peut être vide côté "assistant" si aucune
   * citation directe n'était pertinente pour cette réponse. */
  citations?: ChatCitation[];
}

/** Corps de la requête vers /api/distill/chat — même matière source
 * (texte/photo/PDF) que /api/distill, plus l'historique de la conversation
 * en cours et la nouvelle question. Le PDF est re-téléversé sur Vercel Blob
 * à chaque message, comme pour /api/distill/quiz : chaque appel gère sa
 * propre copie temporaire. */
export interface ChatRequestBody {
  text?: string;
  image?: DistillRequestFile;
  pdf?: PdfBlobReference;
  /** Tours précédents de la conversation, sans les citations (non
   * nécessaires pour la génération de la réponse suivante). */
  history: { role: "user" | "assistant"; content: string }[];
  question: string;
}

export interface ChatResponseBody {
  answer: string;
  citations: ChatCitation[];
}

export interface Profile {
  id: string;
  email: string | null;
  generations_used: number;
  lemonsqueezy_subscription_id: string | null;
  /** "free" tant que l'utilisateur n'a jamais souscrit, sinon le statut
   * Lemon Squeezy brut ("on_trial", "active", "paused", "past_due",
   * "unpaid", "cancelled", "expired"). */
  subscription_status: string;
  created_at: string;
}
