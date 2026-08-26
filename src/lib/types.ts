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
  /** Thème court (2-4 mots) inféré par le modèle à partir du contenu source
   * de la question, ex. "Cycle de Krebs" — sert à regrouper les réponses par
   * sujet pour la détection de lacunes (voir @/app/api/quiz-attempts). */
  theme: string;
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
  /** true quand l'utilisateur demande explicitement un nouveau QCM sur un
   * contenu déjà distillé (bouton "Nouveau QCM sur ce contenu" une fois le
   * précédent corrigé) — par opposition au premier QCM, généré
   * automatiquement avec le résumé/les flashcards et déjà compté dans cette
   * même génération. Seul ce cas consomme une génération gratuite
   * supplémentaire, voir @/app/api/distill/quiz/route.ts. */
  isRegeneration?: boolean;
}

export interface QuizGenerationResult {
  quiz: QuizQuestion[];
}

/** Corps de la requête vers POST /api/quiz-attempts — envoyée par QuizView
 * une fois le QCM corrigé, pour enregistrer chaque réponse et recevoir en
 * retour l'analyse de lacunes à jour (voir QuizThemeStat ci-dessous). */
export interface QuizAttemptsRequestBody {
  answers: { theme: string; question: string; isCorrect: boolean }[];
}

/** Bilan par thème, cumulé sur toutes les réponses déjà enregistrées de
 * l'utilisateur (pas seulement celles du QCM qui vient d'être corrigé) —
 * trié du thème le plus fragile au plus solide (accuracy croissante). Un
 * thème n'apparaît ici qu'à partir de QUIZ_ATTEMPTS_MIN_PER_THEME réponses
 * (voir @/app/api/quiz-attempts/route.ts), pour ne pas juger un thème sur
 * une seule question. */
export interface QuizThemeStat {
  theme: string;
  total: number;
  correct: number;
  accuracy: number;
}

export interface QuizAttemptsResponseBody {
  themes: QuizThemeStat[];
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

/** Citation d'un chat Team Brain — contrairement à ChatCitation (Mode
 * Explication, une seule source implicite : les notes de la session), fait
 * toujours référence à un document précis de l'équipe. */
export interface TeamBrainChatCitation {
  documentName: string;
  pageNumber: number | null;
  quote: string;
}

export interface TeamBrainChatRequestBody {
  projectId: string;
  question: string;
  /** Tours précédents de la conversation, sans citations — voir
   * ChatRequestBody.history pour le même principe. Aucun historique n'est
   * persisté côté serveur (décision actée à l'étape 1 du chantier). */
  history?: { role: "user" | "assistant"; content: string }[];
}

export interface TeamBrainChatResponseBody {
  answer: string;
  citations: TeamBrainChatCitation[];
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
