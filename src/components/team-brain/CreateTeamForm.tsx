"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { parseJsonResponse } from "@/lib/useSubscriptionActions";

/** Formulaire réel de création d'équipe (écran verrouillé Team Brain).
 * Appelle POST /api/team-brain/teams puis rafraîchit la page : TeamBrain.tsx
 * détecte la nouvelle équipe reçue via `initialTeam` et bascule
 * automatiquement sur le vrai Workspace (voir son useEffect dédié). */
export function CreateTeamForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (loading) return;
    if (!name.trim()) {
      setError("Donnez un nom à votre équipe.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/team-brain/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const payload = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Impossible de créer l'équipe.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="lg" className="w-full" onClick={() => setOpen(true)}>
        Créer mon équipe
      </Button>
    );
  }

  return (
    <div className="space-y-2.5 rounded-2xl border border-border bg-card p-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
        placeholder="Nom de l'équipe"
        autoFocus
        className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[13.5px] text-foreground outline-none focus:border-[var(--team)]"
      />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={handleSubmit} disabled={loading} size="sm" className="flex-1">
          {loading ? "Création…" : "Créer"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={loading}
        >
          Annuler
        </Button>
      </div>
    </div>
  );
}
