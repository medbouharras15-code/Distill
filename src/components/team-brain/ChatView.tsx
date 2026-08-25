"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, ChevronLeft, ChevronRight, Send, Shield } from "@/lib/icons";
import { parseJsonResponse } from "@/lib/useSubscriptionActions";
import { TEAM_BRAIN_AI_REPLY, TEAM_BRAIN_NIKE_DOCS, TEAM_BRAIN_SEED_CHAT } from "@/lib/teamBrainMockData";
import type { TeamBrainProject } from "@/lib/teamBrainMockData";
import type { TeamBrainChatResponseBody } from "@/lib/types";

function now(): string {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Source d'une réponse IA — addedBy/date restent optionnels : la démo les
 * fournit toujours (voir toDisplayMessages), une vraie recherche (étape 3)
 * ne renvoie que document/page/extrait, pas encore qui a ajouté le
 * document ni quand. */
interface DisplaySource {
  doc: string;
  page: number | null;
  excerpt: string;
  addedBy?: string;
  date?: string;
}

interface DisplayMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  ts: string;
  /** Une vraie réponse peut citer plusieurs documents, contrairement à la
   * démo qui n'en a jamais qu'un seul — toujours un tableau (0, 1 ou
   * plusieurs), même pour la démo (un seul élément), pour un rendu unifié. */
  sources: DisplaySource[];
}

function toDisplayMessages(seed: typeof TEAM_BRAIN_SEED_CHAT): DisplayMessage[] {
  return seed.map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    ts: m.ts,
    sources: m.source
      ? [{ doc: m.source.doc, page: m.source.page, excerpt: m.source.excerpt, addedBy: m.source.addedBy, date: m.source.date }]
      : [],
  }));
}

function UserBubble({ msg }: { msg: DisplayMessage }) {
  return (
    <div className="flex animate-fade justify-end">
      <div className="group max-w-[76%]">
        <div className="rounded-[18px] rounded-br-[4px] bg-foreground px-4 py-3 text-[14px] leading-[1.65] text-background shadow-[var(--shadow-sm)]">
          {msg.text}
        </div>
        <div className="mt-1 flex justify-end font-mono text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {msg.ts}
        </div>
      </div>
    </div>
  );
}

function SourceBlock({
  source,
  expanded,
  onToggle,
}: {
  source: DisplaySource;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full overflow-hidden rounded-xl border text-left transition-all"
      style={{
        borderColor: "color-mix(in srgb, var(--team) 28%, var(--border))",
        background: "color-mix(in srgb, var(--team) 5%, var(--background))",
      }}
    >
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <div
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[9px] font-bold text-white"
          style={{ background: "linear-gradient(135deg, var(--team), var(--team-2))" }}
        >
          {source.page ?? "·"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[12px] font-semibold" style={{ color: "var(--team)" }}>
              {source.doc}
            </span>
            {source.page !== null && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">p. {source.page}</span>}
          </div>
          {(source.addedBy || source.date) && (
            <div className="text-[10.5px] text-muted-foreground">
              {[source.addedBy, source.date].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        <ChevronRight
          size={13}
          className="shrink-0 text-muted-foreground transition-transform duration-200"
          style={{
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transitionTimingFunction: "var(--ease-signature)",
          }}
        />
      </div>

      {expanded && (
        <div
          className="animate-fade border-t px-3.5 pb-3 pt-2.5 text-[12.5px] leading-relaxed text-foreground"
          style={{ borderColor: "color-mix(in srgb, var(--team) 18%, var(--border))" }}
        >
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            Extrait{source.page !== null ? ` · page ${source.page}` : ""}
          </span>
          « {source.excerpt} »
        </div>
      )}
    </button>
  );
}

function AiBubble({
  msg,
  expandedKey,
  onToggleSource,
}: {
  msg: DisplayMessage;
  expandedKey: string | null;
  onToggleSource: (key: string) => void;
}) {
  return (
    <div className="flex animate-fade items-end gap-2.5">
      <div
        className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-[0_2px_8px_-2px_var(--team-glow)]"
        style={{ background: "linear-gradient(135deg, var(--team), var(--team-2))" }}
      >
        <Brain size={13} />
      </div>

      <div className="group max-w-[84%]">
        <div
          className="relative overflow-hidden rounded-[18px] rounded-bl-[4px] border bg-card shadow-[var(--shadow-sm)]"
          style={{
            borderColor: "color-mix(in srgb, var(--team) 20%, var(--border))",
            borderLeft: "2px solid color-mix(in srgb, var(--team) 45%, transparent)",
          }}
        >
          <div className="relative px-4 py-3.5">
            <p className="text-[14px] leading-[1.72] text-foreground">{msg.text}</p>

            {msg.sources.length > 0 && (
              <div className="mt-3.5 space-y-2">
                {msg.sources.map((source, i) => {
                  const key = `${msg.id}:${i}`;
                  return (
                    <SourceBlock
                      key={key}
                      source={source}
                      expanded={expandedKey === key}
                      onToggle={() => onToggleSource(key)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="mt-1 font-mono text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">{msg.ts}</div>
      </div>
    </div>
  );
}

/** Vue chat Team Brain — étape 4/4. En mode démo (`isReal=false`), la
 * conversation simulée reste identique à ce qu'elle a toujours été
 * (réponse et délai de "réflexion" en dur, aucun appel réseau). En mode
 * réel, chaque question appelle POST /api/team-brain/chat (recherche
 * vectorielle + génération, étape 3) avec l'historique de la conversation
 * pour les questions de suivi. */
export function ChatView({
  project,
  isReal,
  onBack,
  onBackToWorkspace,
}: {
  project: TeamBrainProject;
  isReal: boolean;
  onBack: () => void;
  onBackToWorkspace: () => void;
}) {
  const [messages, setMessages] = useState<DisplayMessage[]>(() => toDisplayMessages(TEAM_BRAIN_SEED_CHAT));
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [thinkingDots, setThinkingDots] = useState(0);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!thinking) return;
    const interval = setInterval(() => setThinkingDots((d) => (d + 1) % 4), 460);
    return () => clearInterval(interval);
  }, [thinking]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  async function send() {
    if (!input.trim() || thinking) return;
    const question = input.trim();
    setError(null);
    setInput("");
    setThinking(true);

    if (!isReal) {
      setMessages((m) => [...m, { id: `u${Date.now()}`, role: "user", ts: now(), text: question, sources: [] }]);
      setTimeout(() => {
        setThinking(false);
        setMessages((m) => [...m, { ...toDisplayMessages([{ ...TEAM_BRAIN_AI_REPLY, id: `a${Date.now()}`, ts: now() }])[0] }]);
      }, 2600);
      return;
    }

    const history = messages.map((m) => ({ role: (m.role === "ai" ? "assistant" : "user") as "assistant" | "user", content: m.text }));
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: "user", ts: now(), text: question, sources: [] }]);

    try {
      const res = await fetch("/api/team-brain/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, question, history }),
      });
      const payload = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Impossible d'obtenir une réponse.");
      }

      const { answer, citations } = payload as unknown as TeamBrainChatResponseBody;
      setMessages((m) => [
        ...m,
        {
          id: `a${Date.now()}`,
          role: "ai",
          ts: now(),
          text: answer,
          sources: citations.map((c) => ({ doc: c.documentName, page: c.pageNumber, excerpt: c.quote })),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      // Retire la question optimiste pour ne pas laisser un message sans
      // réponse dans le fil — même principe que le Mode Explication
      // (@/components/notes/ChatView).
      setMessages((m) => m.slice(0, -1));
    } finally {
      setThinking(false);
    }
  }

  const sharedDocsCount = isReal
    ? undefined // le nombre réel de documents partagés est déjà affiché sur la vue Projet ; pas de recompte ici pour l'instant
    : TEAM_BRAIN_NIKE_DOCS.filter((d) => !d.private).length;

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border bg-card/80 px-5 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <button type="button" onClick={onBackToWorkspace} className="flex items-center gap-1 transition hover:text-foreground">
            <ChevronLeft size={14} /> Workspace
          </button>
          <span className="text-muted-foreground/40">/</span>
          <button type="button" onClick={onBack} className="transition hover:text-foreground">
            {project.name}
          </button>
        </div>

        <div className="ml-1 flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white"
            style={{ background: "linear-gradient(135deg, var(--team), var(--team-2))" }}
          >
            <Brain size={15} />
          </div>
          <div>
            <div className="text-[13.5px] font-semibold text-foreground">Team Brain</div>
            <div className="text-[11px] text-muted-foreground">
              {project.name}
              {sharedDocsCount !== undefined ? ` · ${sharedDocsCount} documents indexés` : ""}
            </div>
          </div>
        </div>

        <span
          className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white"
          style={{ background: "linear-gradient(115deg, var(--team), var(--team-2))" }}
        >
          <Brain size={10} /> Team Brain
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-[680px] flex-col gap-4">
          <div className="flex items-center justify-center gap-2 py-1">
            <div className="h-px flex-1 bg-border" />
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted-foreground shadow-[var(--shadow-sm)]">
              <Shield size={10} style={{ color: "var(--team)" }} />
              Répond uniquement à partir des documents partagés
            </div>
            <div className="h-px flex-1 bg-border" />
          </div>

          {messages.map((msg) =>
            msg.role === "user" ? (
              <UserBubble key={msg.id} msg={msg} />
            ) : (
              <AiBubble key={msg.id} msg={msg} expandedKey={expandedKey} onToggleSource={(key) => setExpandedKey(expandedKey === key ? null : key)} />
            ),
          )}

          {thinking && (
            <div className="flex items-end gap-2.5">
              <div
                className="animate-aipulse mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: "linear-gradient(135deg, var(--team), var(--team-2))" }}
              >
                <Brain size={13} />
              </div>
              <div className="flex items-center gap-3 rounded-[18px] rounded-bl-[4px] border border-border bg-card px-4 py-3 shadow-[var(--shadow-sm)]">
                <div className="flex gap-[5px]">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="animate-team-thinking block h-[5.5px] w-[5.5px] rounded-full"
                      style={{ background: "var(--team)", animationDelay: `${i * 0.17}s` }}
                    />
                  ))}
                </div>
                <span className="text-[12px] text-muted-foreground">
                  Recherche{sharedDocsCount !== undefined ? ` dans ${sharedDocsCount} documents` : ""}
                  {".".repeat(thinkingDots)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border bg-card/80 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto max-w-[680px]">
          {error && (
            <div className="mb-3 flex items-start justify-between gap-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-700">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="shrink-0 text-red-700/70 hover:text-red-700">
                ✕
              </button>
            </div>
          )}
          <div
            className="flex items-end gap-3 rounded-2xl border bg-background px-4 py-3 transition-shadow"
            style={{
              borderColor: input ? "color-mix(in srgb, var(--team) 40%, var(--border))" : "var(--border)",
              boxShadow: input ? "0 0 0 3px color-mix(in srgb, var(--team) 10%, transparent)" : "var(--shadow-sm)",
            }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={thinking}
              placeholder="Posez une question sur vos documents d'équipe…"
              className="flex-1 resize-none bg-transparent text-[14px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/55 disabled:opacity-40"
              style={{ maxHeight: 140, overflowY: "hidden" }}
            />
            <button
              type="button"
              onClick={send}
              disabled={!input.trim() || thinking}
              className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-all duration-200 hover:enabled:-translate-y-px disabled:opacity-30"
              style={{
                background:
                  input.trim() && !thinking ? "linear-gradient(135deg, var(--team), var(--team-2))" : "var(--muted-foreground)",
                boxShadow: input.trim() && !thinking ? "0 4px 14px -4px var(--team-glow)" : "none",
                transitionTimingFunction: "var(--ease-signature)",
              }}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
