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

export interface DistillRequestBody {
  text?: string;
  image?: DistillRequestFile;
  pdf?: DistillRequestFile;
  /** Présent uniquement si l'étudiant a coché "Générer aussi un QCM de
   * révision" — absent, le comportement (prompt, forme de la réponse) est
   * strictement identique à avant l'introduction du QCM. */
  quizDifficulty?: QuizDifficulty;
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
