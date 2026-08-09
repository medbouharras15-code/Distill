export interface Flashcard {
  question: string;
  answer: string;
}

export interface DistillResult {
  summary: string;
  flashcards: Flashcard[];
}

export interface DistillRequestFile {
  /** Données du fichier encodées en base64 (sans le préfixe "data:...;base64,") */
  data: string;
  /** Type MIME du fichier, ex. "image/png" ou "application/pdf" */
  mediaType: string;
}

export interface DistillRequestBody {
  text?: string;
  image?: DistillRequestFile;
  pdf?: DistillRequestFile;
}
