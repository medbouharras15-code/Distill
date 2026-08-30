"use client";

import { useState, type ReactNode } from "react";

interface ToolIconAssetProps {
  asset: string | null;
  fallback: ReactNode;
  alt: string;
  className?: string;
}

/** Affiche l'image réaliste d'un outil (voir lib/notes/toolIconAssets.ts) si
 * elle est configurée et se charge correctement, sinon retombe sur l'icône
 * SVG plate passée en `fallback` — même pendant le chargement, pour éviter
 * un flash vide. Un simple <img> plutôt que next/image : les dimensions des
 * futurs fichiers ne sont pas connues à l'avance. */
export function ToolIconAsset({ asset, fallback, alt, className }: ToolIconAssetProps) {
  const [failed, setFailed] = useState(false);

  if (!asset || failed) return <>{fallback}</>;

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={asset} alt={alt} className={className} onError={() => setFailed(true)} draggable={false} />;
}
