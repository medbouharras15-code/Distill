"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import FileDropZone from "@/components/FileDropZone";
import FlashcardView from "@/components/FlashcardView";
import { AiOrb } from "@/components/Brand";
import { Badge, buttonClasses } from "@/components/ui";
import { Close } from "@/lib/icons";
import { FREE_GENERATIONS_LIMIT, IS_FREE_LIMIT_OVERRIDDEN, isSubscribed } from "@/lib/billing";
import { MAX_PDF_FILE_BYTES } from "@/lib/fileSizeLimits";
import { parseJsonResponse, useSubscriptionActions } from "@/lib/useSubscriptionActions";
import type { DistillResult, QuizDifficulty, QuizGenerationResult } from "@/lib/types";
import { QuizView } from "./QuizView";

const MAX_RAW_IMAGE_BYTES = 20 * 1024 * 1024; // simple garde-fou avant compression
const MAX_PDF_BYTES_LABEL = (MAX_PDF_FILE_BYTES / (1024 * 1024)).toFixed(1); // "3.1" pour l'affichage

// Les photos sont redimensionnées et recompressées côté client : une photo
// d'iPad de plusieurs Mo devient une poignée de centaines de Ko avant envoi,
// ce qui évite à la fois de dépasser la taille de requête autorisée et de
// ralentir inutilement l'analyse par Claude.
const MAX_IMAGE_DIMENSION = 1568;
const IMAGE_JPEG_QUALITY = 0.85;

type Tab = "summary" | "flashcards" | "quiz";

interface AiPanelProps {
  subscriptionStatus: string;
  generationsUsed: number;
  checkoutStatus: "success" | "cancelled" | null;
  onClose: () => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Lecture du fichier impossible."));
        return;
      }
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("Erreur de lecture"));
    reader.readAsDataURL(file);
  });
}

/** Redimensionne et recompresse une image (JPEG) via un canvas, quel que
 * soit son format d'origine. Réduit fortement le poids des photos avant
 * l'envoi au serveur. */
function resizeImageToJpeg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { naturalWidth: width, naturalHeight: height } = img;
      if (!width || !height) {
        reject(new Error("Cette image n'a pas pu être lue. Essayez un autre fichier."));
        return;
      }
      if (Math.max(width, height) > MAX_IMAGE_DIMENSION) {
        const scale = MAX_IMAGE_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Cet appareil ne permet pas de traiter l'image."));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/jpeg", IMAGE_JPEG_QUALITY);
      const base64 = dataUrl.split(",")[1];
      if (!base64) {
        reject(new Error("Cette image n'a pas pu être compressée."));
        return;
      }
      resolve(base64);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Cette image n'a pas pu être ouverte. Essayez un format JPG ou PNG."));
    };

    img.src = objectUrl;
  });
}

/** Panneau IA de l'éditeur — reprend à l'identique le comportement de
 * l'ancien écran DistillApp (coller texte/photo/PDF → résumé/flashcards,
 * gestion d'abonnement) dans le panneau latéral de `/notes`, comme convenu.
 * Même appels réseau (/api/distill, /api/lemonsqueezy/*), même compression
 * d'image, même logique de limite gratuite — seule la présentation change
 * pour s'adapter à un panneau étroit plutôt qu'un écran plein. Le chrome de
 * compte (logo, thème, déconnexion) vit désormais dans AppShell : ce
 * panneau ne garde que ce qui lui est propre. */
export function AiPanel({ subscriptionStatus, generationsUsed, checkoutStatus, onClose }: AiPanelProps) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { billingLoading, billingError, setBillingError, subscribe, cancel } = useSubscriptionActions();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DistillResult | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [localGenerationsUsed, setLocalGenerationsUsed] = useState(generationsUsed);
  const [dismissedCheckoutBanner, setDismissedCheckoutBanner] = useState(false);
  const [quizRequested, setQuizRequested] = useState(false);
  const [quizDifficulty, setQuizDifficulty] = useState<QuizDifficulty>("easy");
  // État du QCM, généré par un appel séparé (/api/distill/quiz) une fois le
  // résumé/les flashcards déjà affichés — voir generateQuiz. Indépendant de
  // `result`/`error`, qui ne concernent que le premier appel.
  const [quizRequestedForResult, setQuizRequestedForResult] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  const subscribed = isSubscribed({ subscription_status: subscriptionStatus });
  const remaining = subscribed ? Infinity : Math.max(0, FREE_GENERATIONS_LIMIT - localGenerationsUsed);
  const limitReached = !subscribed && remaining <= 0;
  const hasInput = text.trim().length > 0 || !!imageFile || !!pdfFile;

  function selectImage(file: File) {
    setError(null);
    if (!file.type.startsWith("image/") && file.type !== "") {
      setError("Ce fichier n'est pas une image reconnue.");
      return;
    }
    if (file.size > MAX_RAW_IMAGE_BYTES) {
      setError("Cette photo est trop volumineuse (20 Mo maximum).");
      return;
    }
    setImageFile(file);
  }

  function selectPdf(file: File) {
    setError(null);
    if (file.size > MAX_PDF_FILE_BYTES) {
      setError(`Le PDF est trop volumineux (${MAX_PDF_BYTES_LABEL} Mo maximum).`);
      return;
    }
    setPdfFile(file);
  }

  /** Génère uniquement le QCM (/api/distill/quiz), en arrière-plan pendant
   * que l'utilisateur consulte déjà le résumé/les flashcards. Gestion
   * d'erreur indépendante du premier appel : un échec ici n'affecte jamais
   * `result` (résumé/flashcards restent affichés), seul l'onglet QCM
   * affiche l'erreur avec un bouton pour réessayer cette seule partie. */
  async function generateQuiz(source: { text?: string; imageData: string | null; pdfData: string | null }) {
    setQuizLoading(true);
    setQuizError(null);
    try {
      const res = await fetch("/api/distill/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: source.text,
          image: source.imageData ? { data: source.imageData, mediaType: "image/jpeg" } : undefined,
          pdf: source.pdfData ? { data: source.pdfData, mediaType: "application/pdf" } : undefined,
          quizDifficulty,
        }),
      });

      const payload = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Impossible de générer le QCM.");
      }

      const { quiz } = payload as unknown as QuizGenerationResult;
      setResult((prev) => (prev ? { ...prev, quiz } : prev));
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setQuizLoading(false);
    }
  }

  /** Relance uniquement le QCM après un échec — recompresse la photo si
   * besoin (rare, contrairement au premier appel qui réutilise directement
   * les données déjà compressées). */
  async function retryQuiz() {
    if (quizLoading) return;
    const [imageData, pdfData] = await Promise.all([
      imageFile ? resizeImageToJpeg(imageFile) : Promise.resolve(null),
      pdfFile ? fileToBase64(pdfFile) : Promise.resolve(null),
    ]);
    await generateQuiz({ text: text.trim() || undefined, imageData, pdfData });
  }

  async function handleSubmit() {
    if (!hasInput || loading || limitReached) return;
    setLoading(true);
    setError(null);

    try {
      // Les photos sont compressées en JPEG côté client (poids réduit et
      // format toujours accepté par l'API) ; les PDF sont envoyés tels quels.
      const [imageData, pdfData] = await Promise.all([
        imageFile ? resizeImageToJpeg(imageFile) : Promise.resolve(null),
        pdfFile ? fileToBase64(pdfFile) : Promise.resolve(null),
      ]);

      // Premier appel : résumé + flashcards uniquement, exactement comme
      // avant l'introduction du QCM — celui-ci n'est jamais envoyé ici.
      const res = await fetch("/api/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim() || undefined,
          image: imageData ? { data: imageData, mediaType: "image/jpeg" } : undefined,
          pdf: pdfData ? { data: pdfData, mediaType: "application/pdf" } : undefined,
        }),
      });

      const payload = await parseJsonResponse(res);

      if (!res.ok) {
        if (payload.limitReached) {
          setLocalGenerationsUsed(FREE_GENERATIONS_LIMIT);
        }
        throw new Error(typeof payload.error === "string" ? payload.error : "Une erreur est survenue.");
      }

      setResult(payload as unknown as DistillResult);
      setTab("summary");
      if (!subscribed) {
        setLocalGenerationsUsed((n) => n + 1);
      }

      // Deuxième appel, en arrière-plan : l'utilisateur voit déjà le résumé
      // et les flashcards pendant que le QCM se génère. Réutilise les
      // données déjà compressées ci-dessus, pas besoin de recompresser.
      if (quizRequested) {
        setQuizRequestedForResult(true);
        void generateQuiz({ text: text.trim() || undefined, imageData, pdfData });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setText("");
    setImageFile(null);
    setPdfFile(null);
    setQuizRequestedForResult(false);
    setQuizLoading(false);
    setQuizError(null);
  }

  return (
    <div className="flex h-full flex-col bg-card">
      {/* En-tête */}
      <div className="relative shrink-0 overflow-hidden border-b border-border px-5 py-4">
        <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full ai-gradient opacity-20 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AiOrb size={36} active />
            <div>
              <div className="text-sm font-semibold text-foreground">IA Distill</div>
              <div className="text-[11px] text-muted-foreground">Résumé, flashcards & QCM</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le panneau IA"
            className="rounded-lg p-1 text-muted-foreground transition hover:bg-background-alt hover:text-foreground"
          >
            <Close size={18} />
          </button>
        </div>

        <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2">
          {subscribed ? (
            <Badge className="bg-accent-light/50 text-accent-dark">✦ Abonné — accès illimité</Badge>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {remaining} génération{remaining !== 1 ? "s" : ""} gratuite{remaining !== 1 ? "s" : ""} restante
              {remaining !== 1 ? "s" : ""}
              {IS_FREE_LIMIT_OVERRIDDEN && <Badge className="bg-amber-100 text-amber-800">Limite de test</Badge>}
            </span>
          )}
          <button
            type="button"
            onClick={subscribed ? cancel : subscribe}
            disabled={billingLoading}
            className={buttonClasses("outline", "sm")}
          >
            {subscribed ? "Annuler mon abonnement" : "S'abonner — 9,99€/mois"}
          </button>
        </div>

        {billingError && (
          <div className="relative mt-3 flex items-start justify-between gap-3 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-700">
            <span>{billingError}</span>
            <button type="button" onClick={() => setBillingError(null)} className="shrink-0 text-red-700/70 hover:text-red-700" aria-label="Fermer">
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {checkoutStatus && !dismissedCheckoutBanner && (
          <div className="mb-4 flex animate-fade items-start justify-between gap-3 rounded-xl border border-accent-light bg-accent-light/30 px-3 py-2.5 text-xs text-accent-dark">
            <span>
              {checkoutStatus === "success"
                ? "Merci ! Votre abonnement est en cours d'activation — cela prend quelques secondes."
                : "Paiement annulé. Vous pouvez réessayer quand vous le souhaitez."}
            </span>
            <button
              type="button"
              onClick={() => setDismissedCheckoutBanner(true)}
              className="shrink-0 text-accent-dark/70 hover:text-accent-dark"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
        )}

        {result ? (
          <div className="animate-fade">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex gap-1.5 rounded-full bg-background-alt p-1">
                <button
                  type="button"
                  onClick={() => setTab("summary")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                    tab === "summary" ? "bg-card text-accent-dark shadow-[var(--shadow-sm)]" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Résumé
                </button>
                <button
                  type="button"
                  onClick={() => setTab("flashcards")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                    tab === "flashcards" ? "bg-card text-accent-dark shadow-[var(--shadow-sm)]" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Flashcards ({result.flashcards.length})
                </button>
                {quizRequestedForResult && (
                  <button
                    type="button"
                    onClick={() => setTab("quiz")}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                      tab === "quiz" ? "bg-card text-accent-dark shadow-[var(--shadow-sm)]" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    QCM{result.quiz ? ` (${result.quiz.length})` : ""}
                  </button>
                )}
              </div>
              <button type="button" onClick={reset} className={buttonClasses("outline", "sm")}>
                ↺ Nouvelle
              </button>
            </div>

            {tab === "quiz" ? (
              result.quiz ? (
                <QuizView quiz={result.quiz} />
              ) : quizError ? (
                <div className="flex animate-fade flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50/40 p-6 text-center">
                  <p className="text-sm text-red-700">{quizError}</p>
                  <button type="button" onClick={retryQuiz} className={buttonClasses("outline", "sm")}>
                    Réessayer
                  </button>
                </div>
              ) : (
                <div className="flex animate-fade flex-col items-center justify-center gap-3 py-16 text-center">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">Génération de votre QCM en cours…</p>
                </div>
              )
            ) : tab === "summary" ? (
              <article className="prose-summary animate-fade rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-sm)]">
                <ReactMarkdown
                  components={{
                    h1: (p) => <h1 className="mb-3 font-display text-lg text-foreground" {...p} />,
                    h2: (p) => <h2 className="mt-4 mb-2 font-display text-base text-foreground first:mt-0" {...p} />,
                    h3: (p) => <h3 className="mt-3 mb-1.5 font-display text-[15px] text-foreground" {...p} />,
                    p: (p) => <p className="mb-2.5 text-sm leading-relaxed text-foreground/90" {...p} />,
                    strong: (p) => <strong className="font-semibold text-accent-dark" {...p} />,
                    ul: (p) => <ul className="mb-2.5 list-disc space-y-1 pl-5 text-sm text-foreground/90" {...p} />,
                    ol: (p) => <ol className="mb-2.5 list-decimal space-y-1 pl-5 text-sm text-foreground/90" {...p} />,
                  }}
                >
                  {result.summary}
                </ReactMarkdown>
              </article>
            ) : (
              <div className="animate-fade space-y-4">
                {result.flashcards.map((card, i) => (
                  <FlashcardView key={i} card={card} index={i} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="animate-fade">
            <label className="mb-2 block text-sm font-medium text-foreground">Collez le texte de vos notes</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Collez ici le contenu de votre cours..."
              rows={6}
              className="mb-4 w-full resize-y rounded-xl border border-border bg-background-alt p-3 text-sm text-foreground transition placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light"
            />

            <div className="mb-4 flex flex-col gap-3">
              <FileDropZone
                label="Photo de notes manuscrites"
                hint="Compressée automatiquement"
                accept="image/*"
                file={imageFile}
                onSelect={selectImage}
                onClear={() => setImageFile(null)}
              />
              <FileDropZone
                label="PDF de cours"
                hint={`Cours scanné ou texte (${MAX_PDF_BYTES_LABEL} Mo max.)`}
                accept="application/pdf"
                file={pdfFile}
                onSelect={selectPdf}
                onClear={() => setPdfFile(null)}
              />
            </div>

            <div className="mb-4 rounded-xl border border-border bg-background-alt p-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={quizRequested}
                  onChange={(e) => setQuizRequested(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-accent"
                />
                Générer aussi un QCM de révision
              </label>
              {quizRequested && (
                <div className="mt-3 flex items-center gap-2.5">
                  <span className="text-xs text-muted-foreground">Difficulté</span>
                  <div className="flex gap-1 rounded-full bg-secondary p-1">
                    {(["easy", "hard"] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setQuizDifficulty(d)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          quizDifficulty === d ? "bg-card text-accent-dark shadow-[var(--shadow-sm)]" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {d === "easy" ? "Facile" : "Difficile"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</p>}

            {limitReached ? (
              <button type="button" onClick={subscribe} disabled={billingLoading} className={buttonClasses("primary", "lg", "w-full")}>
                {billingLoading ? "Redirection vers le paiement…" : "Limite atteinte — S'abonner pour continuer"}
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={!hasInput || loading} className={buttonClasses("primary", "lg", "w-full")}>
                {loading ? "Distillation en cours…" : "Distiller mes notes"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
