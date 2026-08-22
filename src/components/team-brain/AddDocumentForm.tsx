"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { Doc, Lock, Plus } from "@/lib/icons";
import { parseJsonResponse } from "@/lib/useSubscriptionActions";

type Kind = "note" | "pdf";

/** Formulaire réel d'ajout de document Team Brain — étape 4/4, vue Projet.
 * Appelle POST /api/team-brain/documents (indexation, voir @/lib/teamBrainIndexing
 * — construite et testée à l'étape 2) puis rafraîchit la page pour afficher
 * le nouveau document une fois indexé. Rendu uniquement pour un vrai projet
 * (voir ProjectView.tsx, prop `isReal`) : en mode démo, le bouton reste
 * décoratif comme avant, inchangé. */
export function AddDocumentForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("note");
  const [name, setName] = useState("");
  const [noteText, setNoteText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setKind("note");
    setName("");
    setNoteText("");
    setFile(null);
    setIsPrivate(false);
    setError(null);
  }

  async function handleSubmit() {
    if (loading) return;
    if (!name.trim()) {
      setError("Donnez un nom à ce document.");
      return;
    }
    if (kind === "note" && !noteText.trim()) {
      setError("Le contenu de la note est vide.");
      return;
    }
    if (kind === "pdf" && !file) {
      setError("Choisissez un fichier PDF.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let pdfUrl: string | undefined;
      if (kind === "pdf" && file) {
        const blob = await upload(file.name, file, { access: "private", handleUploadUrl: "/api/upload/team-brain" });
        pdfUrl = blob.url;
      }

      const res = await fetch("/api/team-brain/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          name: name.trim(),
          docType: kind,
          isPrivate,
          text: kind === "note" ? noteText : undefined,
          pdfUrl,
        }),
      });
      const payload = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Impossible d'ajouter ce document.");
      }

      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-4 text-[13px] text-muted-foreground transition hover:border-[var(--team)] hover:text-foreground"
      >
        <Plus size={16} /> Ajouter un document ou une note
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex gap-2">
        {(["note", "pdf"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
              kind === k ? "text-white" : "bg-secondary text-muted-foreground"
            }`}
            style={kind === k ? { background: "linear-gradient(135deg, var(--team), var(--team-2))" } : undefined}
          >
            <Doc size={12} /> {k === "note" ? "Note" : "PDF"}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom du document"
        className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[13.5px] text-foreground outline-none focus:border-[var(--team)]"
      />

      {kind === "note" ? (
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Contenu de la note…"
          rows={5}
          className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-[13.5px] text-foreground outline-none focus:border-[var(--team)]"
        />
      ) : (
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-[13px] text-muted-foreground"
        />
      )}

      <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="h-3.5 w-3.5" />
        <Lock size={12} /> Document privé (visible uniquement par vous)
      </label>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button onClick={handleSubmit} disabled={loading} size="sm" className="flex-1">
          {loading ? "Ajout…" : "Ajouter"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={loading}
        >
          Annuler
        </Button>
      </div>
    </div>
  );
}
