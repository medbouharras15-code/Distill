"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import FileDropZone from "@/components/FileDropZone";
import FlashcardView from "@/components/FlashcardView";
import { AiOrb } from "@/components/Brand";
import { Badge, buttonClasses } from "@/components/ui";
import { Close } from "@/lib/icons";
import { FREE_GENERATIONS_LIMIT, isSubscribed } from "@/lib/billing";
import type { DistillResult } from "@/lib/types";

// Vercel limite la taille d'une requête à ~4,5 Mo. Le base64 gonfle les
// données d'environ 33 % : on garde donc une marge de sécurité pour les PDF
// (qui ne peuvent pas être compressés côté client, contrairement aux images).
const MAX_PDF_BYTES = 3 * 1024 * 1024; // 3 Mo
const MAX_RAW_IMAGE_BYTES = 20 * 1024 * 1024; // simple garde-fou avant compression

// Les photos sont redimensionnées et recompressées côté client : une photo
// d'iPad de plusieurs Mo devient une poignée de centaines de Ko avant envoi,
// ce qui évite à la fois de dépasser la taille de requête autorisée et de
// ralentir inutilement l'analyse par Claude.
const MAX_IMAGE_DIMENSION = 1568;
const IMAGE_JPEG_QUALITY = 0.85;

type Tab = "summary" | "flashcards";

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

/** Lit une réponse HTTP comme du JSON, en donnant un message clair si le
 * serveur (ou une plateforme intermédiaire comme Vercel) a renvoyé autre
 * chose que du JSON — par exemple après un délai d'exécution dépassé. */
async function parseJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const raw = await res.text();
  try {
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    throw new Error(
      res.ok
        ? "Réponse du serveur illisible. Réessayez."
        : `Le serveur a mis trop de temps à répondre ou a rejeté la requête (code ${res.status}). Réessayez avec un fichier plus léger.`,
    );
  }
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
  const [billingLoading, setBillingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DistillResult | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [localGenerationsUsed, setLocalGenerationsUsed] = useState(generationsUsed);
  const [dismissedCheckoutBanner, setDismissedCheckoutBanner] = useState(false);

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
    if (file.size > MAX_PDF_BYTES) {
      setError("Le PDF est trop volumineux (3 Mo maximum).");
      return;
    }
    setPdfFile(file);
  }

  async function handleSubscribe() {
    if (billingLoading) return;
    setBillingLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lemonsqueezy/checkout", { method: "POST" });
      const payload = await parseJsonResponse(res);
      if (!res.ok || typeof payload.url !== "string") {
        throw new Error(typeof payload.error === "string" ? payload.error : "Impossible de démarrer le paiement.");
      }
      // Redirige vers la page hébergée par Lemon Squeezy : la carte bancaire
      // y est saisie directement, elle ne transite jamais par notre serveur.
      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setBillingLoading(false);
    }
  }

  async function handleCancelSubscription() {
    if (billingLoading) return;
    if (!window.confirm("Annuler votre abonnement Distill ? L'accès illimité s'arrêtera immédiatement.")) {
      return;
    }
    setBillingLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lemonsqueezy/cancel", { method: "POST" });
      const payload = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Impossible d'annuler l'abonnement.");
      }
      // Recharge la page pour refléter le nouveau statut (recalculé côté
      // serveur dans page.tsx).
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setBillingLoading(false);
    }
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
              <div className="text-[11px] text-muted-foreground">Résumé & flashcards</div>
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
            <span className="text-xs text-muted-foreground">
              {remaining} génération{remaining !== 1 ? "s" : ""} gratuite{remaining !== 1 ? "s" : ""} restante
              {remaining !== 1 ? "s" : ""}
            </span>
          )}
          <button
            type="button"
            onClick={subscribed ? handleCancelSubscription : handleSubscribe}
            disabled={billingLoading}
            className={buttonClasses("outline", "sm")}
          >
            {subscribed ? "Annuler mon abonnement" : "S'abonner — 9,99€/mois"}
          </button>
        </div>
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
              </div>
              <button type="button" onClick={reset} className={buttonClasses("outline", "sm")}>
                ↺ Nouvelle
              </button>
            </div>

            {tab === "summary" ? (
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
                hint="Cours scanné ou texte (3 Mo max.)"
                accept="application/pdf"
                file={pdfFile}
                onSelect={selectPdf}
                onClear={() => setPdfFile(null)}
              />
            </div>

            {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</p>}

            {limitReached ? (
              <button type="button" onClick={handleSubscribe} disabled={billingLoading} className={buttonClasses("primary", "lg", "w-full")}>
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
