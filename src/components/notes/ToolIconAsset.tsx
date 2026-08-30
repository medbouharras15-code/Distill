"use client";

import { useState, type ReactNode } from "react";

interface ToolIconAssetProps {
  asset: string | null;
  fallback: ReactNode;
  alt: string;
}

/** Affiche l'image réaliste d'un outil (voir lib/notes/toolIconAssets.ts) si
 * elle est configurée et se charge correctement, sinon retombe sur l'icône
 * SVG plate passée en `fallback` — même pendant le chargement, pour éviter
 * un flash vide. Un simple <img> plutôt que next/image : les dimensions des
 * futurs fichiers ne sont pas connues à l'avance.
 *
 * L'image remplit tout l'espace disponible (`object-contain`, léger
 * padding) plutôt qu'une taille fixe : quel que soit le ratio/cadrage du
 * fichier source fourni pour chaque outil, toutes les icônes réalistes se
 * retrouvent ainsi à la même taille visuelle une fois affichées côte à côte
 * dans la barre — voir public/tools/README.md pour le gabarit recommandé. */
export function ToolIconAsset({ asset, fallback, alt }: ToolIconAssetProps) {
  const [failed, setFailed] = useState(false);

  if (!asset || failed) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset}
      alt={alt}
      draggable={false}
      onError={() => setFailed(true)}
      className="h-full w-full object-contain p-1"
    />
  );
}
