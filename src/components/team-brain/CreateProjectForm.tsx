"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { parseJsonResponse } from "@/lib/useSubscriptionActions";

/** Formulaire réel de création de projet (Workspace, vraie équipe). Appelle
 * POST /api/team-brain/projects puis rafraîchit la page pour afficher le
 * nouveau projet. Ouverture/fermeture pilotée par le parent (WorkspaceView)
 * plutôt qu'auto-gérée : deux déclencheurs y ouvrent ce même formulaire
 * (bouton d'en-tête + carte pointillée), contrairement à AddDocumentForm
 * qui n'en a qu'un. */
export function CreateProjectForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (loading) return;
    if (!name.trim()) {
      setError("Donnez un nom à votre projet.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/team-brain/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), emoji: emoji.trim() || undefined }),
      });
      const payload = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Impossible de créer le projet.");
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setLoading(false);
    }
  }

  return (
    <div className="mb-4 space-y-2.5 rounded-2xl border border-border bg-card p-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="📁"
          maxLength={4}
          className="w-16 shrink-0 rounded-xl border border-border bg-background px-3 py-2.5 text-center text-[16px] outline-none focus:border-[var(--team)]"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder="Nom du projet"
          autoFocus
          className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 text-[13.5px] text-foreground outline-none focus:border-[var(--team)]"
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={handleSubmit} disabled={loading} size="sm" className="flex-1">
          {loading ? "Création…" : "Créer le projet"}
        </Button>
        <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
