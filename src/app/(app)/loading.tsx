"use client";

import { useEffect, useState } from "react";
import { DistillMark } from "@/components/Brand";

/** État de chargement entre deux pages de la coquille (Dashboard, Mes
 * carnets…). Sans ce fichier, Next.js attend que la navigation soit
 * entièrement résolue côté serveur avant de rien afficher — chaque
 * changement de page relit la session/le profil Supabase (aucune mise en
 * cache), donc cette attente réseau existait déjà avant l'ajout du
 * fondu-enchaîné (AppShell). La différence : sans limite de temps de
 * rendu (React Suspense), le <ViewTransition> retient l'affichage jusqu'à
 * ce que la nouvelle page soit prête, ce qui transforme cette attente
 * réseau normale en interface qui semble figée. Ce loading.tsx crée la
 * limite Suspense attendue par Next : la navigation peut aboutir
 * immédiatement sur cet état intermédiaire pendant que les données
 * chargent, au lieu de bloquer.
 *
 * Le léger délai avant affichage (200ms) évite un flash inutile sur les
 * navigations déjà rapides — seules celles qui prennent réellement du
 * temps le laissent apparaître. */
export default function AppLoading() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 200);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="flex min-h-[60vh] animate-fade items-center justify-center">
      <span className="text-muted-foreground/40 animate-aipulse" aria-hidden="true">
        <DistillMark size={26} />
      </span>
    </div>
  );
}
