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

export interface DistillResult {
  summary: string;
  flashcards: Flashcard[];
  /** Absent si l'étudiant n'a pas demandé de QCM lors de la génération. */
  quiz?: QuizQuestion[];
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
}

export interface QuizGenerationResult {
  quiz: QuizQuestion[];
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
