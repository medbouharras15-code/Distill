"use client";

import { useEffect, useRef } from "react";
import { getDocumentProxy } from "unpdf";

type PdfDocumentProxy = Awaited<ReturnType<typeof getDocumentProxy>>;

interface PdfPageLayerProps {
  /** Id de l'import PDF source (voir PdfPageBackground) — pas utilisé pour
   * le cache (voir `url`), seulement exposé en attribut de débogage. */
  sourceId: string;
  url: string;
  /** 1-indexé, comme PdfPageBackground.pageNumber. */
  pageNumber: number;
  /** Dimensions logiques de la page Distill — déjà dans le ratio natif du
   * PDF (voir pdfPageDimensions dans NotesCanvas.tsx), donc un rendu plein
   * cadre ici ne déforme jamais la page. */
  pageWidth: number;
  pageHeight: number;
}

/** Cache module-level par URL de PDF — un seul fetch + parsing par source
 * PDF, partagé par toutes les pages Distill qui en affichent une page
 * différente (voir sourceId/url communs dans PdfPageBackground), plutôt
 * qu'un rechargement indépendant par instance/rendu React. */
const documentCache = new Map<string, Promise<PdfDocumentProxy>>();

function getCachedDocument(url: string): Promise<PdfDocumentProxy> {
  let cached = documentCache.get(url);
  if (!cached) {
    cached = fetch(url)
      .then((res) => res.arrayBuffer())
      .then((buffer) => getDocumentProxy(new Uint8Array(buffer)));
    // Un échec (réseau, PDF corrompu...) ne doit pas rester en cache pour
    // toujours — une page qui remonte ensuite doit pouvoir réessayer.
    cached.catch(() => documentCache.delete(url));
    documentCache.set(url, cached);
  }
  return cached;
}

/** Calque de fond non interactif d'une page PDF importée (voir
 * PdfPageBackground) : charge la source PDF (mise en cache par `url`,
 * jamais rechargée par page), rend uniquement `pageNumber`, plein cadre
 * (`pageWidth`/`pageHeight` correspondent déjà exactement au ratio natif de
 * cette page PDF — pas de recadrage/déformation). Résolution physique =
 * résolution logique x devicePixelRatio, même principe que le canvas
 * d'encre de NotesCanvas.tsx, pour rester net à tout niveau de zoom du
 * carnet (le zoom lui-même est appliqué en CSS par NotesPageClient, jamais
 * en redessinant ce canvas). N'écoute aucun événement : purement visuel,
 * `pointer-events: none` est appliqué par le conteneur (voir
 * NotesCanvas.tsx), jamais ici, pour rester une seule source de vérité. */
export function PdfPageLayer({ sourceId, url, pageNumber, pageWidth, pageHeight }: PdfPageLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const doc = await getCachedDocument(url);
        if (cancelled) return;
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const nativeViewport = page.getViewport({ scale: 1 });
        const scale = (pageWidth * dpr) / nativeViewport.width;
        const viewport = page.getViewport({ scale });
        canvas.width = Math.round(pageWidth * dpr);
        canvas.height = Math.round(pageHeight * dpr);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      } catch (err) {
        console.error("Impossible de rendre la page PDF :", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, pageNumber, pageWidth, pageHeight]);

  return (
    <canvas
      ref={canvasRef}
      data-pdf-source-id={sourceId}
      aria-hidden="true"
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
