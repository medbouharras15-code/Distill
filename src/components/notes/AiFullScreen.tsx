"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/Brand";
import { ChevronLeft } from "@/lib/icons";
import { AiPanel } from "./AiPanel";

interface AiFullScreenProps {
  subscriptionStatus: string;
  generationsUsed: number;
}

/** Page dédiée à l'IA (résumé/flashcards à partir de texte/photo/PDF), en
 * plein écran et sans le canvas de dessin à côté — deuxième point d'accès à
 * l'IA, en plus du panneau latéral de l'éditeur (/notes, inchangé). Réutilise
 * @/components/notes/AiPanel tel quel : aucune logique dupliquée, seule la
 * mise en page change (plein écran plutôt que panneau étroit coulissant). */
export function AiFullScreen({ subscriptionStatus, generationsUsed }: AiFullScreenProps) {
  const router = useRouter();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
          <ChevronLeft size={16} /> Tableau de bord
        </Link>
        <Wordmark size={20} />
        <div className="w-24" aria-hidden="true" />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border shadow-[var(--shadow-lg)]">
        <AiPanel
          subscriptionStatus={subscriptionStatus}
          generationsUsed={generationsUsed}
          checkoutStatus={null}
          onClose={() => router.push("/dashboard")}
        />
      </div>
    </div>
  );
}
