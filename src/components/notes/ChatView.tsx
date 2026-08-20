"use client";

import { useEffect, useRef, useState } from "react";
import { DistillMark } from "@/components/Brand";
import { Close, Send } from "@/lib/icons";
import { resizeImageToJpeg, uploadPdfToBlob } from "@/lib/aiMedia";
import { TYPICAL_JETONS } from "@/lib/jetons";
import { parseJsonResponse } from "@/lib/useSubscriptionActions";
import type { ChatMessage, ChatResponseBody } from "@/lib/types";

const SUGGESTED_QUESTIONS = [
  "Explique-moi ce point plus simplement",
  "Donne-moi un exemple concret",
  "Quels sont les points essentiels à retenir ?",
  "Pourquoi est-ce important de connaître ça ?",
];

const CITATION_CONTEXT_RADIUS = 140;

interface ChatViewProps {
  /** Pour l'estimation en jetons affichée au-dessus de la barre de saisie
   * (voir @/lib/jetons) — n'a de sens que pour les abonnés, le quota
   * gratuit se mesurant en générations, pas en jetons. */
  subscribed: boolean;
  /** Même matière source que le reste de la session — voir AiPanel.
   * Aucune n'est mutée ici, uniquement relue pour chaque message. */
  text: string;
  imageFile: File | null;
  pdfFile: File | null;
}

/** Libellé honnête de la source affichée en en-tête — pas de "carnet"
 * fictif : les carnets ne sont pas encore une vraie donnée persistée (voir
 * échange de validation), donc on décrit simplement ce qui a été distillé
 * dans cette session. */
function describeSource(text: string, imageFile: File | null, pdfFile: File | null): string {
  const trimmed = text.trim();
  if (trimmed) {
    return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
  }
  if (pdfFile) return pdfFile.name;
  if (imageFile) return imageFile.name;
  return "cette distillation";
}

/** Cherche `quote` comme sous-chaîne exacte de `text` pour un éventuel
 * surlignage — ne fonctionne que pour une source texte : sans texte
 * source (photo/PDF), ou si le modèle a légèrement reformulé la citation,
 * retombe simplement sur l'affichage de la citation seule (voir CitationOverlay). */
function locateQuote(text: string, quote: string): { before: string; match: string; after: string } | null {
  if (!text) return null;
  const idx = text.indexOf(quote);
  if (idx === -1) return null;
  return {
    before: text.slice(Math.max(0, idx - CITATION_CONTEXT_RADIUS), idx),
    match: quote,
    after: text.slice(idx + quote.length, idx + quote.length + CITATION_CONTEXT_RADIUS),
  };
}

function CitationOverlay({ quote, sourceText, onClose }: { quote: string; sourceText: string; onClose: () => void }) {
  const located = locateQuote(sourceText, quote);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm animate-fade rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Passage cité
          </span>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-muted-foreground transition hover:text-foreground">
            <Close size={16} />
          </button>
        </div>
        {located ? (
          <p className="text-[13.5px] leading-relaxed text-foreground/80">
            {located.before && <span className="opacity-60">…{located.before}</span>}
            <mark className="rounded bg-accent-light px-0.5 text-accent-dark">{located.match}</mark>
            {located.after && <span className="opacity-60">{located.after}…</span>}
          </p>
        ) : (
          <>
            <p className="text-[13.5px] italic leading-relaxed text-foreground/90">« {quote} »</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Extrait approximatif — le passage exact n&apos;a pas pu être localisé précisément dans la source
              (photo ou PDF).
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** Mode Explication — chat qui répond aux questions de l'étudiant
 * uniquement à partir de la matière (texte/photo/PDF) déjà distillée dans
 * cette session du panneau IA (voir /api/distill/chat). Historique tenu
 * uniquement en mémoire ici (aucune persistance serveur), perdu à la
 * fermeture du panneau — comme convenu. */
export function ChatView({ text, imageFile, pdfFile, subscribed }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  // Mémorise le JPEG redimensionné pour la photo source le temps de la
  // session : recalculer un ré-encodage à chaque message produirait des
  // octets légèrement différents d'un appel à l'autre et casserait la mise
  // en cache Anthropic côté serveur (qui exige un préfixe strictement
  // identique). Indexé par référence de File : une nouvelle photo invalide
  // naturellement l'entrée.
  const imageDataCache = useRef<{ file: File; data: Promise<string> } | null>(null);

  function getCachedImageData(file: File): Promise<string> {
    if (imageDataCache.current?.file !== file) {
      imageDataCache.current = { file, data: resizeImageToJpeg(file) };
    }
    return imageDataCache.current.data;
  }

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function sendMessage(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setError(null);
    setInput("");
    const priorTurns = messages.map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setLoading(true);

    try {
      const [imageData, pdfRef] = await Promise.all([
        imageFile ? getCachedImageData(imageFile) : Promise.resolve(null),
        pdfFile ? uploadPdfToBlob(pdfFile) : Promise.resolve(null),
      ]);

      const res = await fetch("/api/distill/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim() || undefined,
          image: imageData ? { data: imageData, mediaType: "image/jpeg" } : undefined,
          pdf: pdfRef ?? undefined,
          history: priorTurns,
          question: trimmed,
        }),
      });

      const payload = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Impossible d'obtenir une réponse.");
      }

      const { answer, citations } = payload as unknown as ChatResponseBody;
      setMessages((prev) => [...prev, { role: "assistant", content: answer, citations }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      // Retire la question optimiste pour ne pas laisser un message sans
      // réponse dans le fil — l'utilisateur peut la retaper ou en reposer
      // une autre.
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  const sourceLabel = describeSource(text, imageFile, pdfFile);

  return (
    // Pas de hauteur/scroll propres ici : le conteneur du panneau
    // (flex-1 overflow-auto, voir AiPanel) est déjà la zone de défilement —
    // exactement comme la barre de validation "sticky" de QuizView, dont ce
    // pied de saisie reprend le même procédé.
    <div className="animate-fade">
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-background-alt/60 px-3 py-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full ai-gradient text-white">
          <DistillMark size={12} />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Basé sur</div>
          <div className="truncate text-[12.5px] text-foreground">{sourceLabel}</div>
        </div>
      </div>

      <div className="space-y-3 pb-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 py-8 text-center">
            <div>
              <div className="font-display text-base font-medium text-foreground">Posez une question sur vos notes</div>
              <div className="mt-1 text-[13px] text-muted-foreground">
                L&apos;IA répond uniquement à partir de ce que vous avez distillé — jamais de connaissances générales.
              </div>
            </div>
            <div className="grid w-full gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void sendMessage(q)}
                  className="rounded-xl border border-border bg-card px-3.5 py-2.5 text-left text-[13px] text-foreground transition hover:border-accent/50 hover:bg-accent-light/20"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex animate-fade ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <span className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ai-gradient text-white">
                  <DistillMark size={12} />
                </span>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-[var(--primary-foreground)]"
                    : "border border-border bg-card text-foreground"
                }`}
              >
                {m.content}
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.citations.map((c, ci) => (
                      <button
                        key={ci}
                        type="button"
                        onClick={() => setActiveCitation(c.quote)}
                        className="rounded-full border border-border bg-background-alt px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-accent/50 hover:text-accent-dark"
                      >
                        « {c.quote.length > 40 ? `${c.quote.slice(0, 40)}…` : c.quote} »
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex animate-fade justify-start">
            <span className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ai-gradient text-white">
              <DistillMark size={12} />
            </span>
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5">
              <span className="text-primary animate-distill-loop" aria-hidden="true">
                <DistillMark size={14} />
              </span>
              <span className="text-[12px] text-muted-foreground">Réflexion…</span>
            </div>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</p>}

        <div ref={threadEndRef} />
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        {subscribed && (
          <p className="mb-2 text-center text-[11px] text-muted-foreground">
            ≈ {TYPICAL_JETONS.messageChat} jetons par message — le coût réel peut varier selon la taille du document.
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            placeholder="Posez une question sur vos notes…"
            rows={1}
            className="max-h-32 flex-1 resize-none overflow-y-auto rounded-2xl border border-border bg-card px-3.5 py-2.5 text-[13.5px] leading-relaxed text-foreground transition placeholder:text-muted-foreground/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light"
          />
          <button
            type="button"
            onClick={() => void sendMessage(input)}
            disabled={!input.trim() || loading}
            aria-label="Envoyer la question"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full ai-gradient text-white shadow-[0_4px_14px_-6px_var(--ai-glow)] transition disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {activeCitation && (
        <CitationOverlay quote={activeCitation} sourceText={text} onClose={() => setActiveCitation(null)} />
      )}
    </div>
  );
}
