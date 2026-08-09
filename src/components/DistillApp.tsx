"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import FileDropZone from "@/components/FileDropZone";
import FlashcardView from "@/components/FlashcardView";
import type { DistillResult } from "@/lib/types";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 Mo, doit correspondre à la limite côté serveur

type Tab = "summary" | "flashcards";

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

export default function DistillApp() {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DistillResult | null>(null);
  const [tab, setTab] = useState<Tab>("summary");

  const hasInput = text.trim().length > 0 || !!imageFile || !!pdfFile;

  function selectImage(file: File) {
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError("L'image est trop volumineuse (8 Mo maximum).");
      return;
    }
    setImageFile(file);
  }

  function selectPdf(file: File) {
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError("Le PDF est trop volumineux (8 Mo maximum).");
      return;
    }
    setPdfFile(file);
  }

  async function handleSubmit() {
    if (!hasInput || loading) return;
    setLoading(true);
    setError(null);

    try {
      const [imageData, pdfData] = await Promise.all([
        imageFile ? fileToBase64(imageFile) : Promise.resolve(null),
        pdfFile ? fileToBase64(pdfFile) : Promise.resolve(null),
      ]);

      const res = await fetch("/api/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim() || undefined,
          image: imageData
            ? { data: imageData, mediaType: imageFile!.type }
            : undefined,
          pdf: pdfData ? { data: pdfData, mediaType: "application/pdf" } : undefined,
        }),
      });

      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.error ?? "Une erreur est survenue.");
      }

      setResult(payload as DistillResult);
      setTab("summary");
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

  if (result) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <span className="font-display text-2xl text-foreground">Distill</span>
          <button
            onClick={reset}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent-dark"
          >
            ↺ Nouvelle distillation
          </button>
        </div>

        <div className="mb-6 flex gap-2 rounded-full bg-background-alt p-1">
          <button
            onClick={() => setTab("summary")}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === "summary"
                ? "bg-card text-accent-dark shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            Résumé
          </button>
          <button
            onClick={() => setTab("flashcards")}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === "flashcards"
                ? "bg-card text-accent-dark shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            Flashcards ({result.flashcards.length})
          </button>
        </div>

        {tab === "summary" ? (
          <article className="prose-summary rounded-2xl border border-border bg-card p-8 shadow-sm">
            <ReactMarkdown
              components={{
                h1: (p) => (
                  <h1
                    className="mb-4 font-display text-2xl text-foreground"
                    {...p}
                  />
                ),
                h2: (p) => (
                  <h2
                    className="mt-6 mb-3 font-display text-xl text-foreground first:mt-0"
                    {...p}
                  />
                ),
                h3: (p) => (
                  <h3
                    className="mt-4 mb-2 font-display text-lg text-foreground"
                    {...p}
                  />
                ),
                p: (p) => (
                  <p className="mb-3 leading-relaxed text-foreground/90" {...p} />
                ),
                strong: (p) => (
                  <strong className="font-semibold text-accent-dark" {...p} />
                ),
                ul: (p) => (
                  <ul className="mb-3 list-disc space-y-1 pl-5 text-foreground/90" {...p} />
                ),
                ol: (p) => (
                  <ol className="mb-3 list-decimal space-y-1 pl-5 text-foreground/90" {...p} />
                ),
              }}
            >
              {result.summary}
            </ReactMarkdown>
          </article>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {result.flashcards.map((card, i) => (
              <FlashcardView key={i} card={card} index={i} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16">
      <div className="mb-10 text-center">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-accent-dark">
          Distill
        </p>
        <h1 className="font-display text-4xl leading-tight text-foreground sm:text-5xl">
          Vos notes de cours,
          <br />
          <span className="italic text-accent-dark">distillées</span> en
          l&apos;essentiel.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base text-muted">
          Collez du texte, une photo de vos notes manuscrites ou un PDF de
          cours : Distill génère un résumé structuré et des flashcards de
          révision en quelques secondes.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <label className="mb-2 block text-sm font-medium text-foreground">
          Collez le texte de vos notes
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Collez ici le contenu de votre cours..."
          rows={8}
          className="mb-6 w-full resize-y rounded-xl border border-border bg-background-alt p-4 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light"
        />

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FileDropZone
            label="Photo de notes manuscrites"
            hint="PNG, JPG ou WEBP"
            accept="image/png,image/jpeg,image/webp,image/gif"
            file={imageFile}
            onSelect={selectImage}
            onClear={() => setImageFile(null)}
          />
          <FileDropZone
            label="PDF de cours"
            hint="Cours scanné ou texte"
            accept="application/pdf"
            file={pdfFile}
            onSelect={selectPdf}
            onClear={() => setPdfFile(null)}
          />
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!hasInput || loading}
          className="w-full rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Distillation en cours…" : "Distiller mes notes"}
        </button>
      </div>
    </div>
  );
}
