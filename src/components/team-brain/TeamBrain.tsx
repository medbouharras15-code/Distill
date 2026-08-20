"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { UpsellView } from "./UpsellView";

/** Écran de secours pour les vues pas encore construites (voir étapes
 * suivantes du chantier Team Brain) — évite de casser la navigation locale
 * pendant la construction progressive des 5 vues. À retirer une fois
 * WorkspaceView/ProjectView/ChatView/MembersView tous construits. */
function ComingSoonView({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-[700px] px-5 py-16 text-center md:px-10">
      <Card className="paper-grain p-10">
        <p className="text-sm text-muted-foreground">Écran « {label} » à venir dans une prochaine étape.</p>
      </Card>
    </div>
  );
}

/** Racine de la démo Team Brain — design uniquement, aucune logique de
 * paiement/permissions réelle (voir plan validé). Navigation par état local
 * plutôt que par sous-routes Next.js, fidèle à la structure du prototype
 * Figma Make source. `unlocked` reste toujours `false` au premier rendu :
 * personne n'a d'abonnement Team aujourd'hui, l'utilisateur doit
 * explicitement choisir "Explorer la démo" sur l'écran verrouillé. */
export function TeamBrain() {
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) {
    return <UpsellView onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <ComingSoonView label="Workspace" />
    </div>
  );
}
