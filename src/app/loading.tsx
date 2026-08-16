"use client";

import { useEffect, useState } from "react";
import { DistillMark } from "@/components/Brand";

/** Filet de sécurité global : couvre toute navigation qui n'a pas de
 * loading.tsx plus spécifique sur son propre segment — notamment l'entrée
 * dans l'éditeur (/notes, /distill) depuis le Dashboard/Mes carnets/etc.,
 * qui bascule entre deux branches de routes entièrement différentes
 * (aucun chrome partagé avec la coquille de @/app/(app)). Ces pages
 * relisent elles aussi la session/le profil Supabase à chaque navigation
 * (aucune mise en cache) : sans cette limite Suspense, Next.js retient
 * l'affichage jusqu'à la fin de cet appel réseau, exactement le même
 * symptôme que celui corrigé sur (app)/loading.tsx.
 *
 * Même délai d'apparition (200ms) qu'(app)/loading.tsx, pour la même
 * raison : ne jamais flasher sur les navigations déjà rapides. */
export default function RootLoading() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 200);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="flex min-h-dvh animate-fade items-center justify-center bg-background">
      <span className="text-muted-foreground/40 animate-aipulse" aria-hidden="true">
        <DistillMark size={30} />
      </span>
    </div>
  );
}
