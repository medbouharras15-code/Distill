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

export interface Profile {
  id: string;
  email: string | null;
  generations_used: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  /** "free" tant que l'utilisateur n'a jamais payé, sinon le statut Stripe
   * brut ("active", "trialing", "past_due", "canceled", ...). */
  subscription_status: string;
  created_at: string;
}
