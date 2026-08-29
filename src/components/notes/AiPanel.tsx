"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import FileDropZone from "@/components/FileDropZone";
import { AiOrb, DistillMark } from "@/components/Brand";
import { Badge, Card, Eyebrow, buttonClasses, staggerDelay } from "@/components/ui";
import { IS_SIMULATION_ENABLED } from "@/lib/aiSimulation";
import { Cards, Chat, Close, Doc, Pen, Quiz, Sparkle } from "@/lib/icons";
import { resizeImageToJpeg, uploadPdfToBlob } from "@/lib/aiMedia";
import { FREE_GENERATIONS_LIMIT, IS_FREE_LIMIT_OVERRIDDEN, getTier, isSubscribed } from "@/lib/billing";
import type { SubscriptionProvider } from "@/lib/billing";
import { MAX_PDF_FILE_BYTES } from "@/lib/fileSizeLimits";
import { TYPICAL_JETONS } from "@/lib/jetons";
import { parseJsonResponse, useSubscriptionActions } from "@/lib/useSubscriptionActions";
import type { DistillResult, QuizDifficulty, QuizGenerationResult } from "@/lib/types";
import { ChatView } from "./ChatView";
import { FlashcardDeck } from "./FlashcardDeck";
import { PhotoIcon } from "./icons";
import { QuizView } from "./QuizView";

const MAX_RAW_IMAGE_BYTES = 20 * 1024 * 1024; // simple garde-fou avant compression
const MAX_PDF_BYTES_LABEL = (MAX_PDF_FILE_BYTES / (1024 * 1024)).toFixed(0); // "15" pour l'affichage

type Tab = "summary" | "flashcards" | "quiz" | "chat";

interface AiPanelProps {
  subscriptionStatus: string;
  subscriptionTier: string | null;
  subscriptionProvider: SubscriptionProvider;
  paddleCustomerId: string | null;
  generationsUsed: number;
  checkoutStatus: "success" | "cancelled" | null;
  onClose: () => void;
}

/** État de chargement signature de l'IA Distill — le repère de marque se
 * soulève et retombe en boucle (goutte qui se distille), plutôt qu'un
 * spinner générique. Utilisé pour toute attente propre à l'IA (ici, la
 * génération du QCM en arrière-plan). */
export function DistillingLoader({ label }: { label: string }) {
  return (
    <div className="flex animate-fade flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
        <span className="absolute inset-0 rounded-full ai-gradient opacity-25 animate-aipulse" aria-hidden="true" />
        <span className="relative text-accent animate-distill-loop" aria-hidden="true">
          <DistillMark size={28} />
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/** Écran de génération (résumé + flashcards) affiché pendant `loading` — à
 * la place du formulaire, plutôt qu'un simple bouton désactivé. Les trois
 * repères (Lecture/Structuration/Génération) pulsent en boucle décalée :
 * on n'a aucun signal réel de progression par étape (un seul appel réseau,
 * pas de streaming), donc ils restent volontairement indéterminés — jamais
 * de fausse coche "terminé" qui prétendrait suivre une progression qu'on
 * n'a pas. */
function GeneratingState({ quizNext }: { quizNext: boolean }) {
  const steps = ["Lecture", "Structuration", "Génération"];
  return (
    <div className="flex animate-fade flex-col items-center justify-center gap-8 py-14 text-center">
      <div className="relative flex items-center justify-center">
        <div
          className="absolute h-28 w-28 rounded-full opacity-60"
          style={{ background: "radial-gradient(ellipse, color-mix(in srgb, var(--ai-2) 20%, transparent) 0%, transparent 70%)" }}
          aria-hidden="true"
        />
        <span className="relative z-10 text-primary animate-distill-loop" aria-hidden="true">
          <DistillMark size={44} />
        </span>
      </div>

      <div>
        <div className="font-display text-lg font-medium tracking-tight text-foreground">Distillation en cours</div>
        <div className="mt-1.5 text-sm text-muted-foreground">
          Résumé et flashcards en préparation{quizNext ? " · QCM à suivre" : ""}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary animate-aipulse" style={staggerDelay(i, 300)} aria-hidden="true" />
              <span className="text-[11px] text-muted-foreground">{step}</span>
            </div>
            {i < steps.length - 1 && <div className="h-px w-5 bg-border" aria-hidden="true" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Carte de statut (non interactive) pour la source "texte" — accompagne
 * visuellement les cartes Photo/PDF sans dupliquer la zone de saisie : le
 * texte reste toujours combinable avec une photo et/ou un PDF, exactement
 * comme avant (contrairement à une sélection exclusive d'une seule
 * source). */
function TextSourceStatus({ charCount }: { charCount: number }) {
  const active = charCount > 0;
  return (
    <div
      className={`relative flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200 ${
        active ? "border-accent bg-accent-light/30 shadow-[var(--shadow-sm)]" : "border-border bg-card"
      }`}
    >
      {active && <span className="absolute right-3.5 top-3.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
          active ? "bg-accent text-accent-foreground" : "bg-background-alt text-muted-foreground"
        }`}
      >
        <Pen size={18} />
      </span>
      <div>
        <div className="text-[13px] font-semibold text-foreground">Coller du texte</div>
        <div className="mt-0.5 text-[12px] text-muted-foreground">
          {active ? `${charCount} caractères` : "Un paragraphe, un cours, des notes"}
        </div>
      </div>
    </div>
  );
}

/** Sélecteur de difficulté du QCM — pilule glissante, même valeur/setter
 * qu'avant (quizDifficulty/setQuizDifficulty), seul l'habillage change. */
function DifficultyToggle({ value, onChange }: { value: QuizDifficulty; onChange: (d: QuizDifficulty) => void }) {
  return (
    <div className="relative flex rounded-xl border border-border bg-secondary p-1">
      <span
        className="absolute top-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-lg bg-card shadow-[var(--shadow-sm)] transition-all duration-300"
        style={{ left: value === "easy" ? "4px" : "calc(50% + 0px)" }}
        aria-hidden="true"
      />
      {(["easy", "hard"] as const).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className={`relative z-10 flex h-8 w-20 items-center justify-center rounded-lg text-[12.5px] font-medium transition-colors duration-200 ${
            value === d ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {d === "easy" ? "Facile" : "Difficile"}
        </button>
      ))}
    </div>
  );
}

/** Résumé — même donnée qu'avant (une seule chaîne Markdown renvoyée par
 * Claude, voir /api/distill), habillée en carte "hero" avec halo IA et
 * titres de section marqués d'un repère — pas de numérotation (ça
 * demanderait un compteur muté pendant le rendu, contraire aux règles de
 * pureté des composants). */
function SummaryView({ markdown }: { markdown: string }) {
  return (
    <Card className="paper-grain relative animate-tab-enter overflow-hidden p-6">
      <div
        className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full opacity-50"
        style={{ background: "radial-gradient(ellipse, color-mix(in srgb, var(--ai-2) 22%, transparent) 0%, transparent 68%)" }}
        aria-hidden="true"
      />
      <div className="relative">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full ai-gradient text-white">
            <DistillMark size={14} />
          </span>
          <Eyebrow>Résumé IA</Eyebrow>
        </div>

        <article className="prose-summary">
          <ReactMarkdown
            components={{
              h1: (p) => <h1 className="mb-3 font-display text-xl font-medium tracking-[-0.01em] text-foreground" {...p} />,
              h2: (p) => (
                <div className="mb-2.5 mt-6 flex items-center gap-2.5 first:mt-0">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  <h2 className="font-display text-[15px] font-medium tracking-tight text-foreground" {...p} />
                </div>
              ),
              h3: (p) => <h3 className="mb-1.5 mt-3 font-display text-[14px] text-foreground" {...p} />,
              p: (p) => <p className="mb-2.5 text-sm leading-relaxed text-foreground/90" {...p} />,
              strong: (p) => <strong className="font-semibold text-accent-dark" {...p} />,
              ul: (p) => <ul className="mb-2.5 list-disc space-y-1.5 pl-5 text-sm text-foreground/90 marker:text-primary/60" {...p} />,
              ol: (p) => <ol className="mb-2.5 list-decimal space-y-1.5 pl-5 text-sm text-foreground/90" {...p} />,
            }}
          >
            {markdown}
          </ReactMarkdown>
        </article>

        <div className="mt-5 flex items-center justify-center gap-1.5 border-t border-border pt-4 text-[12px] text-muted-foreground">
          <span className="ai-text flex items-center gap-1 font-medium">
            <Sparkle size={12} /> Généré par IA Distill
          </span>
        </div>
      </div>
    </Card>
  );
}

/** Panneau IA de l'éditeur — reprend à l'identique le comportement de
 * l'ancien écran DistillApp (coller texte/photo/PDF → résumé/flashcards,
 * gestion d'abonnement) dans le panneau latéral de `/notes`, comme convenu.
 * Même appels réseau (/api/distill, /api/lemonsqueezy/*), même compression
 * d'image, même logique de limite gratuite — seule la présentation change
 * pour s'adapter à un panneau étroit plutôt qu'un écran plein. Le chrome de
 * compte (logo, thème, déconnexion) vit désormais dans AppShell : ce
 * panneau ne garde que ce qui lui est propre. */
export function AiPanel({
  subscriptionStatus,
  subscriptionTier,
  subscriptionProvider,
  paddleCustomerId,
  generationsUsed,
  checkoutStatus,
  onClose,
}: AiPanelProps) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { billingLoading, billingError, setBillingError, subscribeToTier, cancel } = useSubscriptionActions(
    subscriptionProvider,
    paddleCustomerId,
  );
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
  // Incrémenté à chaque QCM (re)généré avec succès — utilisé comme `key` sur
  // QuizView pour forcer un remontage complet (réponses/correction/analyse
  // de lacunes remises à zéro) à l'arrivée d'un nouveau jeu de questions,
  // qu'un simple changement de la prop `quiz` ne provoquerait pas seul.
  const [quizVersion, setQuizVersion] = useState(0);
  // Identifie le document/texte distillé en cours — généré une fois par
  // nouvelle distillation (voir handleSubmit), partagé par le premier QCM
  // et toutes ses régénérations sur ce même contenu. Transmis à QuizView
  // pour scoper la détection de lacunes à CE document uniquement (voir
  // /api/quiz-attempts) — sans lui, les résultats de plusieurs PDF
  // différents se mélangeraient dans une même analyse.
  const [distillationId, setDistillationId] = useState<string | null>(null);

  const subscribed = isSubscribed({ subscription_status: subscriptionStatus });
  // `null` en essai gratuit (jamais restreint par les paliers, voir getTier)
  // ou pour un abonné dont le palier reste à déterminer par le serveur.
  const tier = getTier({ subscription_status: subscriptionStatus, subscription_tier: subscriptionTier });
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

  /** Génère le QCM (/api/distill/quiz), en arrière-plan pendant que
   * l'utilisateur consulte déjà le résumé/les flashcards. Relit
   * `text`/`imageFile`/`pdfFile` directement dans l'état et effectue sa
   * propre compression/upload, car le serveur supprime le PDF Blob de
   * chaque appel juste après usage — impossible de réutiliser la référence
   * du premier appel ici. `isRegeneration` distingue le premier QCM d'une
   * distillation (déjà couvert par cette génération, y compris son
   * éventuel réessai après échec via le bouton "Réessayer") d'un nouveau
   * QCM explicitement redemandé sur le même contenu une fois le précédent
   * corrigé (bouton "Nouveau QCM sur ce contenu" dans QuizView) — seul ce
   * second cas consomme sa propre génération gratuite côté serveur, voir
   * /api/distill/quiz. Efface `result.quiz` avant de repartir dans ce
   * second cas pour que l'onglet QCM retombe sur l'indicateur de
   * chargement plutôt que de laisser affichée la correction du QCM
   * précédent pendant l'attente. Gestion d'erreur indépendante du premier
   * appel : un échec ici n'affecte jamais `result.summary`/`flashcards`,
   * seul l'onglet QCM affiche l'erreur. */
  async function generateQuiz(isRegeneration = false) {
    if (quizLoading) return;
    setQuizLoading(true);
    setQuizError(null);
    if (isRegeneration) {
      setResult((prev) => (prev ? { ...prev, quiz: undefined } : prev));
    }
    try {
      const [imageData, pdfRef] = await Promise.all([
        imageFile ? resizeImageToJpeg(imageFile) : Promise.resolve(null),
        pdfFile ? uploadPdfToBlob(pdfFile) : Promise.resolve(null),
      ]);

      const res = await fetch("/api/distill/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim() || undefined,
          image: imageData ? { data: imageData, mediaType: "image/jpeg" } : undefined,
          pdf: pdfRef ?? undefined,
          quizDifficulty,
          isRegeneration,
        }),
      });

      const payload = await parseJsonResponse(res);
      if (!res.ok) {
        if (payload.limitReached) {
          setLocalGenerationsUsed(FREE_GENERATIONS_LIMIT);
        }
        throw new Error(typeof payload.error === "string" ? payload.error : "Impossible de générer le QCM.");
      }

      const { quiz } = payload as unknown as QuizGenerationResult;
      setResult((prev) => (prev ? { ...prev, quiz } : prev));
      setQuizVersion((v) => v + 1);
      if (isRegeneration && !subscribed) {
        setLocalGenerationsUsed((n) => n + 1);
      }
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setQuizLoading(false);
    }
  }

  async function handleSubmit() {
    if (!hasInput || loading || limitReached) return;
    setLoading(true);
    setError(null);
    // Nouveau document distillé : nouvel identifiant, voir distillationId
    // ci-dessus.
    setDistillationId(crypto.randomUUID());

    try {
      // Les photos sont compressées en JPEG côté client (poids réduit et
      // format toujours accepté par l'API) ; les PDF sont téléversés
      // directement vers Vercel Blob, pour ne plus être bornés par la
      // limite de taille de requête de Vercel.
      const [imageData, pdfRef] = await Promise.all([
        imageFile ? resizeImageToJpeg(imageFile) : Promise.resolve(null),
        pdfFile ? uploadPdfToBlob(pdfFile) : Promise.resolve(null),
      ]);

      // Premier appel : résumé + flashcards uniquement, exactement comme
      // avant l'introduction du QCM — celui-ci n'est jamais envoyé ici.
      const res = await fetch("/api/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim() || undefined,
          image: imageData ? { data: imageData, mediaType: "image/jpeg" } : undefined,
          pdf: pdfRef ?? undefined,
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
      // et les flashcards pendant que le QCM se génère. Téléverse sa propre
      // copie du PDF (voir generateQuiz) : celle du premier appel a déjà
      // été supprimée côté serveur juste après usage.
      if (quizRequested) {
        setQuizRequestedForResult(true);
        void generateQuiz();
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
    setDistillationId(null);
  }

  const TAB_CONFIG: { id: Tab; label: string; icon: typeof Doc }[] = [
    { id: "summary", label: "Résumé", icon: Doc },
    { id: "flashcards", label: "Flashcards", icon: Cards },
    { id: "quiz", label: "QCM", icon: Quiz },
    { id: "chat", label: "Explication", icon: Chat },
  ];

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
          <div className="flex flex-wrap items-center gap-2">
            {/* Indépendant du statut d'abonnement (contrairement au badge
             * "Limite de test" ci-dessous) : le mode simulation n'a aucun
             * rapport avec la facturation, il doit rester visible dans tous
             * les cas dès qu'il est actif. */}
            {IS_SIMULATION_ENABLED && (
              <Badge className="bg-purple-100 text-purple-800">🧪 Mode simulation</Badge>
            )}
            {subscribed ? (
              <Badge className="bg-accent-light/50 text-accent-dark">✦ Abonné — accès illimité</Badge>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {remaining} génération{remaining !== 1 ? "s" : ""} gratuite{remaining !== 1 ? "s" : ""} restante
                {remaining !== 1 ? "s" : ""}
                {IS_FREE_LIMIT_OVERRIDDEN && <Badge className="bg-amber-100 text-amber-800">Limite de test</Badge>}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={subscribed ? cancel : () => void subscribeToTier("etudiant")}
            disabled={billingLoading}
            className={buttonClasses("outline", "sm")}
          >
            {subscribed ? "Annuler mon abonnement" : "S'abonner — 8,99€/mois"}
          </button>
        </div>

        {billingError && (
          <div className="relative mt-3 flex items-start justify-between gap-3 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-700">
            <span className="whitespace-pre-wrap break-words">{billingError}</span>
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
            <div className="mb-6 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-[var(--shadow-sm)]">
                {TAB_CONFIG.map(({ id, label, icon: Icon }) => {
                  if (id === "quiz" && !quizRequestedForResult) return null;
                  // Le Mode Explication n'est pas inclus dans l'offre
                  // Essentiel (voir /api/distill/chat) — onglet visible mais
                  // désactivé plutôt que masqué, même logique que la case
                  // QCM plus haut.
                  if (id === "chat" && tier === "essentiel") {
                    return (
                      <span
                        key={id}
                        className="flex cursor-not-allowed items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground/50"
                      >
                        <Icon size={13} />
                        {label}
                      </span>
                    );
                  }
                  const on = tab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTab(id)}
                      className={`relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-medium transition-all duration-200 ${
                        on ? "bg-foreground text-background shadow-[var(--shadow-sm)]" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon size={13} />
                      {label}
                      {id === "flashcards" && ` (${result.flashcards.length})`}
                      {id === "quiz" && result.quiz ? ` (${result.quiz.length})` : ""}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[12px] text-muted-foreground shadow-[var(--shadow-sm)] transition hover:text-foreground"
              >
                <Sparkle size={12} /> Nouvelle analyse
              </button>
            </div>

            <div key={tab}>
              {tab === "quiz" ? (
                result.quiz && distillationId ? (
                  <QuizView
                    key={quizVersion}
                    quiz={result.quiz}
                    distillationId={distillationId}
                    tier={tier}
                    onRegenerate={() => void generateQuiz(true)}
                  />
                ) : quizError ? (
                  <div className="flex animate-fade flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50/40 p-6 text-center">
                    <p className="text-sm text-red-700">{quizError}</p>
                    <button type="button" onClick={() => void generateQuiz()} className={buttonClasses("outline", "sm")}>
                      Réessayer
                    </button>
                  </div>
                ) : (
                  <DistillingLoader label="Génération de votre QCM en cours…" />
                )
              ) : tab === "summary" ? (
                <SummaryView markdown={result.summary} />
              ) : tab === "chat" ? (
                <ChatView text={text} imageFile={imageFile} pdfFile={pdfFile} subscribed={subscribed} />
              ) : (
                <FlashcardDeck cards={result.flashcards} />
              )}
            </div>
          </div>
        ) : (
          <div className="animate-fade">
            {loading ? (
              <GeneratingState quizNext={quizRequested} />
            ) : (
              <>
                <Eyebrow>Source de contenu</Eyebrow>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  <TextSourceStatus charCount={text.trim().length} />
                  <FileDropZone
                    label="Photo de notes manuscrites"
                    hint="JPG, PNG — compressée automatiquement"
                    icon={<PhotoIcon className="h-5 w-5" />}
                    accept="image/*"
                    file={imageFile}
                    onSelect={selectImage}
                    onClear={() => setImageFile(null)}
                  />
                  <FileDropZone
                    label="PDF de cours"
                    hint={`Cours scanné ou texte (${MAX_PDF_BYTES_LABEL} Mo max.)`}
                    icon={<Doc size={20} />}
                    accept="application/pdf"
                    file={pdfFile}
                    onSelect={selectPdf}
                    onClear={() => setPdfFile(null)}
                  />
                </div>

                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Collez ici le contenu de votre cours..."
                  rows={6}
                  className="paper-grain mt-4 w-full resize-y rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed text-foreground shadow-[var(--shadow-sm)] transition placeholder:text-muted-foreground/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light"
                />

                <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
                  {tier === "essentiel" ? (
                    // Le QCM n'est pas inclus dans l'offre Essentiel (voir
                    // /api/distill/quiz) — case désactivée avec message
                    // d'upsell plutôt que masquée, pour que la fonctionnalité
                    // reste visible/désirable même sans y avoir accès.
                    <div className="flex cursor-not-allowed items-center gap-2.5 text-sm font-medium text-muted-foreground/60">
                      <input type="checkbox" checked={false} disabled className="h-4 w-4 shrink-0" />
                      Générer aussi un QCM de révision
                      <Badge className="ml-auto bg-secondary text-secondary-foreground">Étudiant et +</Badge>
                    </div>
                  ) : (
                    <>
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
                          <DifficultyToggle value={quizDifficulty} onChange={setQuizDifficulty} />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</p>}

                {limitReached ? (
                  <button
                    type="button"
                    onClick={() => void subscribeToTier("etudiant")}
                    disabled={billingLoading}
                    className={buttonClasses("primary", "lg", "mt-4 w-full rounded-2xl shadow-[0_2px_4px_rgba(0,0,0,0.08),0_16px_40px_-16px_var(--primary)]")}
                  >
                    {billingLoading ? "Redirection vers le paiement…" : "Limite atteinte — S'abonner pour continuer"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!hasInput}
                    className={buttonClasses("primary", "lg", "mt-4 w-full rounded-2xl shadow-[0_2px_4px_rgba(0,0,0,0.08),0_16px_40px_-16px_var(--primary)]")}
                  >
                    <span className="relative flex h-4 w-4 items-center justify-center">
                      <DistillMark size={16} />
                    </span>
                    Distiller mes notes
                  </button>
                )}

                {subscribed && !limitReached && (
                  <p className="mt-2 text-center text-[11px] text-muted-foreground">
                    ≈ {quizRequested ? TYPICAL_JETONS.resumeEtQcm : TYPICAL_JETONS.resumeSeul} jetons pour un document
                    de taille standard — le coût réel peut varier selon la taille du document.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
