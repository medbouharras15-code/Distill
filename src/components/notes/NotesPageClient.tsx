"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NotesCanvas, type NotesCanvasHandle, type NotesTool } from "@/components/notes/NotesCanvas";
import { BackLink } from "@/components/ui";
import {
  HIGHLIGHTER_COLORS,
  HIGHLIGHTER_SIZES,
  NotesToolbar,
  PEN_COLORS,
  PEN_SIZES,
  SHAPE_COLORS,
  SHAPE_STROKE_WIDTHS,
} from "@/components/notes/NotesToolbar";
import { SheetSelector } from "@/components/notes/SheetSelector";
import { AiPanel } from "@/components/notes/AiPanel";
import type { SubscriptionProvider } from "@/lib/billing";
import { BACKGROUND_COLORS, PAPER_SIZES, SHEET_TYPES, getPageDimensions } from "@/lib/notes/sheets";
import type { EraserMode, PaperSize, PenType, ShapeType, SheetType } from "@/lib/notes/types";

/** Une page de l'éditeur — juste un identifiant : chaque page garde tout son
 * contenu (traits, formes, historique annuler/rétablir...) à l'intérieur de
 * sa propre instance NotesCanvas, voir plus bas. Purement en mémoire pour
 * l'instant (pas de sauvegarde, comme le reste de l'éditeur aujourd'hui). */
interface EditorPage {
  id: string;
}

interface NotesAuth {
  subscriptionStatus: string;
  subscriptionTier: string | null;
  subscriptionProvider: SubscriptionProvider;
  generationsUsed: number;
}

interface NotesPageClientProps {
  auth: NotesAuth | null;
  checkoutStatus: "success" | "cancelled" | null;
  /** Ouvre le panneau IA dès l'arrivée sur la page (lien "IA Distill" de la
   * sidebar ou carte IA du Dashboard, voir ?ai=1 dans @/app/notes/page.tsx). */
  openAi: boolean;
}

export default function NotesPageClient({ auth, checkoutStatus, openAi }: NotesPageClientProps) {
  const router = useRouter();

  // Pages multiples : chaque page est une instance NotesCanvas indépendante
  // (son propre contenu, son propre historique annuler/rétablir), empilées
  // verticalement dans pagesScrollRef (voir plus bas). pageRefs/pageSlotEls
  // sont des Map plutôt que des tableaux de refs car les pages ne sont
  // jamais réordonnées/retirées en v1, seulement ajoutées — une Map indexée
  // par id reste correcte même si React ne réutilise pas les instances dans
  // le même ordre.
  const [pages, setPages] = useState<EditorPage[]>(() => [{ id: crypto.randomUUID() }]);
  const pageRefs = useRef<Map<string, NotesCanvasHandle>>(new Map());
  const pageSlotEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const pagesScrollRef = useRef<HTMLDivElement | null>(null);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [historyByPage, setHistoryByPage] = useState<Record<string, { canUndo: boolean; canRedo: boolean }>>({});
  const [slotHeight, setSlotHeight] = useState(0);

  const [sheetChosen, setSheetChosen] = useState(false);
  const [sheetPanelOpen, setSheetPanelOpen] = useState(false);
  const [sheetType, setSheetType] = useState<SheetType>("plain");
  const [paperSize, setPaperSize] = useState<PaperSize>("letter");
  const [backgroundColor, setBackgroundColor] = useState(BACKGROUND_COLORS[0].value);

  const [tool, setTool] = useState<NotesTool>("pen");
  const [previousTool, setPreviousTool] = useState<NotesTool>("pen");
  const [tempEraser, setTempEraser] = useState(false);

  const [penColor, setPenColor] = useState(PEN_COLORS[0].value);
  const [penSize, setPenSize] = useState(PEN_SIZES[2]);
  const [penType, setPenType] = useState<PenType>("fineliner");

  const [highlighterColor, setHighlighterColor] = useState(HIGHLIGHTER_COLORS[0].value);
  const [highlighterSize, setHighlighterSize] = useState(HIGHLIGHTER_SIZES[2]);

  const [eraserRadius, setEraserRadius] = useState(18);
  const [eraserMode, setEraserMode] = useState<EraserMode>("whole");

  const [shapeType, setShapeType] = useState<ShapeType>("rectangle");
  const [shapeColor, setShapeColor] = useState(SHAPE_COLORS[0].value);
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState(SHAPE_STROKE_WIDTHS[2]);

  // Panneau IA (résumé/flashcards à partir de texte/photo/PDF) — repris de
  // l'ancien écran DistillApp, voir @/components/notes/AiPanel. Ouvert par
  // défaut via ?ai=1 (lien "IA Distill" de la sidebar / carte IA du
  // Dashboard) ou au retour d'un paiement Lemon Squeezy directement sur
  // cette page, pour que la confirmation soit immédiatement visible.
  const [aiOpen, setAiOpen] = useState(() => auth !== null && (openAi || checkoutStatus !== null));

  function toggleAi() {
    if (!auth) {
      router.push("/login");
      return;
    }
    setAiOpen((v) => !v);
  }

  // Indicateur de debug temporaire pour le hold-timer : ajouter ?debug=1 à
  // l'URL (ex. sur iPad) pour l'activer sans redéploiement.
  const [debugHoldDetection] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("debug") === "1";
  });

  function selectPen() {
    setTool("pen");
    setTempEraser(false);
  }

  function selectHighlighter() {
    setTool("highlighter");
    setTempEraser(false);
  }

  function selectEraser() {
    setTool("eraser");
    setTempEraser(false);
  }

  function selectShapes() {
    setTool("shapes");
    setTempEraser(false);
  }

  function selectPhoto() {
    setTool("photo");
    setTempEraser(false);
  }

  function selectPan() {
    setTool("pan");
    setTempEraser(false);
  }

  function selectText() {
    setTool("text");
    setTempEraser(false);
  }

  /** Bascule rapide vers la gomme, avec retour automatique à l'outil
   * précédent après usage — déclenchée par le double-clic sur l'icône
   * stylo ou par un double-tap de la pointe du stylet sur la feuille. */
  function activateTempEraser() {
    if (tool !== "eraser") {
      setPreviousTool(tool);
    }
    setTool("eraser");
    setTempEraser(true);
  }

  function handleActionComplete() {
    if (tempEraser) {
      setTool(previousTool);
      setTempEraser(false);
    }
  }

  /** Après chaque trait/forme terminé sur une page : logique de gomme
   * temporaire habituelle (inchangée), plus l'ajout automatique d'une page
   * juste en dessous si la page concernée est la dernière de la liste — la
   * page suivante existe donc déjà avant même que l'utilisateur ait besoin
   * de défiler jusqu'à elle. Ne se déclenche qu'une fois par page : dès
   * l'ajout, `lastPage.id !== pageId` devient vrai pour cette page-là, plus
   * besoin d'un drapeau "déjà déclenché" séparé. */
  function handlePageActionComplete(pageId: string) {
    handleActionComplete();
    setPages((prev) => {
      const lastPage = prev[prev.length - 1];
      if (!lastPage || lastPage.id !== pageId) return prev;
      return [...prev, { id: crypto.randomUUID() }];
    });
  }

  // Hauteur d'une page dans la liste défilante : la largeur disponible du
  // conteneur, convertie via le ratio du format papier choisi — pas de
  // hauteur fixe arbitraire, pour que chaque page ait exactement la même
  // proportion que la feuille elle-même (comme un affichage à 100 % dans
  // NotesCanvas, mais borné à sa propre tranche plutôt qu'à tout l'écran).
  useLayoutEffect(() => {
    const el = pagesScrollRef.current;
    if (!el) return;
    const { width: pageW, height: pageH } = getPageDimensions(paperSize);
    const ratio = pageH / pageW;
    const update = () => setSlotHeight(el.clientWidth * ratio);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [paperSize]);

  // Détermine quelle page est actuellement à l'écran, pour l'indicateur
  // "Page N" et pour cibler Annuler/Rétablir/Ajuster à l'écran/Ajouter une
  // photo sur la bonne instance — reconstruit à chaque ajout de page
  // (tableau court, jamais réordonné/retiré en v1, donc sans coût réel).
  useEffect(() => {
    const root = pagesScrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting && (!best || entry.intersectionRatio > best.intersectionRatio)) {
            best = entry;
          }
        }
        const id = best?.target.getAttribute("data-page-id");
        if (id) setCurrentPageId(id);
      },
      { root, threshold: [0.25, 0.5, 0.75, 1] },
    );
    for (const el of pageSlotEls.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [pages]);

  const currentPageIndex = pages.findIndex((p) => p.id === currentPageId);
  const currentPageLabel = `Page ${currentPageIndex >= 0 ? currentPageIndex + 1 : 1}`;
  const activeHistory = currentPageId ? historyByPage[currentPageId] : undefined;

  /** Lit pageRefs.current au moment de l'appel (jamais pendant le rendu) —
   * utilisée uniquement à l'intérieur des gestionnaires d'événements de la
   * barre d'outils (Annuler/Rétablir/Ajuster à l'écran/Ajouter une photo),
   * pour cibler la page actuellement active. */
  function getActivePageHandle(): NotesCanvasHandle | undefined {
    return currentPageId ? pageRefs.current.get(currentPageId) : undefined;
  }

  const sheetLabel = SHEET_TYPES.find((s) => s.value === sheetType)?.label ?? sheetType;
  const paperLabel = PAPER_SIZES.find((p) => p.value === paperSize)?.label ?? paperSize;

  if (!sheetChosen) {
    return (
      <div
        className="notes-no-callout mx-auto flex min-h-full w-full max-w-4xl select-none flex-col gap-6 px-4 py-6 sm:px-6"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between">
          <BackLink href="/dashboard">Retour à Distill</BackLink>
          <h1 className="font-display text-lg font-medium text-foreground">Notes à main levée</h1>
          <div className="w-24" />
        </div>

        <SheetSelector
          sheetType={sheetType}
          onSheetTypeChange={setSheetType}
          paperSize={paperSize}
          onPaperSizeChange={setPaperSize}
          backgroundColor={backgroundColor}
          onBackgroundColorChange={setBackgroundColor}
          onConfirm={() => setSheetChosen(true)}
          confirmLabel="Commencer à écrire"
        />
      </div>
    );
  }

  return (
    <div
      className="notes-no-callout flex h-dvh w-full select-none flex-col overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Barre supérieure (en-tête, sélecteur de feuille) : garde la mise en
          page centrée/aérée du reste du site. La barre d'outils, elle, flotte
          directement au-dessus du canvas ci-dessous (voir plus bas) plutôt
          que de vivre ici, pour un rendu "palette posée sur la feuille"
          plutôt qu'une simple rangée de boutons dans l'en-tête. La zone du
          canvas sort volontairement de ce conteneur pour toucher les bords de
          l'écran sans aucune marge — c'est elle que l'utilisateur perçoit
          comme "la feuille" et qui doit remplir tout l'espace disponible,
          sans bande de couleur de fond visible autour. */}
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pt-6 sm:px-6">
        <div className="flex items-center justify-between">
          <BackLink href="/dashboard">Retour à Distill</BackLink>
          <h1 className="font-display text-lg font-medium text-foreground">Notes à main levée</h1>
          <div className="w-24" />
        </div>

        <button
          type="button"
          onClick={() => setSheetPanelOpen(true)}
          className="flex w-fit items-center gap-2 self-center rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
        >
          <span
            className="h-3 w-3 rounded-full border border-border"
            style={{ backgroundColor }}
            aria-hidden="true"
          />
          {sheetLabel} · {paperLabel}
        </button>
      </div>

      <div className="relative mt-3 min-h-0 w-full flex-1">
        {/* Liste défilante des pages : chaque page occupe une tranche de
            hauteur fixe (slotHeight, calculée depuis la largeur disponible
            et le format papier — voir l'effet plus haut), séparées par une
            fine ligne. C'est ce conteneur qui défile pour passer d'une page
            à l'autre ; le défilement interne de chaque NotesCanvas (pan/zoom
            à l'intérieur d'une page) reste indépendant et inchangé. */}
        <div ref={pagesScrollRef} className="h-full w-full overflow-y-auto overflow-x-hidden">
          {pages.map((page, index) => (
            <div key={page.id}>
              {index > 0 && <div className="h-px w-full bg-border" aria-hidden="true" />}
              <div
                data-page-id={page.id}
                ref={(el) => {
                  if (el) pageSlotEls.current.set(page.id, el);
                  else pageSlotEls.current.delete(page.id);
                }}
                onPointerDownCapture={() => setCurrentPageId(page.id)}
                style={{ height: slotHeight || undefined }}
                className="w-full"
              >
                <NotesCanvas
                  ref={(handle) => {
                    if (handle) pageRefs.current.set(page.id, handle);
                    else pageRefs.current.delete(page.id);
                  }}
                  tool={tool}
                  penColor={penColor}
                  penSize={penSize}
                  penType={penType}
                  highlighterColor={highlighterColor}
                  highlighterSize={highlighterSize}
                  eraserRadius={eraserRadius}
                  eraserMode={eraserMode}
                  shapeType={shapeType}
                  shapeColor={shapeColor}
                  shapeStrokeWidth={shapeStrokeWidth}
                  sheetType={sheetType}
                  paperSize={paperSize}
                  backgroundColor={backgroundColor}
                  debugHoldDetection={debugHoldDetection}
                  onActionComplete={() => handlePageActionComplete(page.id)}
                  onPenDoubleTap={activateTempEraser}
                  onHistoryChange={(undo, redo) => {
                    setHistoryByPage((prev) => ({ ...prev, [page.id]: { canUndo: undo, canRedo: redo } }));
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Indicateur de page — reflète currentPageId, mis à jour au scroll
            (IntersectionObserver, voir plus haut) et immédiatement au tap/
            clic sur une page. */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-full border border-border/60 bg-card/95 px-3.5 py-2 text-xs font-medium text-foreground/80 shadow-[var(--shadow-md)] backdrop-blur-sm">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
          {/* key={currentPageLabel} : rejoue le fondu (animate-fade, courbe
              --ease-signature) à chaque changement de page plutôt que de
              simplement remplacer le texte d'un coup. */}
          <span key={currentPageLabel} className="animate-fade tabular-nums">
            {currentPageLabel}
          </span>
        </div>

        {/* Barre d'outils flottante, posée au-dessus de la feuille plutôt que
            dans l'en-tête (voir plus haut) — pointer-events-none sur le
            conteneur pleine largeur pour ne jamais intercepter le dessin
            autour de la pilule, réactivé uniquement sur la pilule elle-même.
            z-20 comme l'assombrissement ci-dessous, rendu avant lui pour
            qu'il s'assombrisse aussi avec le canvas à l'ouverture du panneau
            IA plutôt que de rester au premier plan, détaché du reste. */}
        <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-4">
          <div className="pointer-events-auto w-full max-w-3xl">
            <NotesToolbar
              tool={tool}
              onSelectPen={selectPen}
              onSelectHighlighter={selectHighlighter}
              onSelectEraser={selectEraser}
              onSelectShapes={selectShapes}
              onSelectPhoto={selectPhoto}
              onSelectPan={selectPan}
              onSelectText={selectText}
              onPenDoubleClick={activateTempEraser}
              onImportPhotos={(files) => getActivePageHandle()?.importPhotos(files)}
              penColor={penColor}
              onPenColorChange={setPenColor}
              penSize={penSize}
              onPenSizeChange={setPenSize}
              penType={penType}
              onPenTypeChange={setPenType}
              highlighterColor={highlighterColor}
              onHighlighterColorChange={setHighlighterColor}
              highlighterSize={highlighterSize}
              onHighlighterSizeChange={setHighlighterSize}
              eraserRadius={eraserRadius}
              onEraserRadiusChange={setEraserRadius}
              eraserMode={eraserMode}
              onEraserModeChange={setEraserMode}
              shapeType={shapeType}
              onShapeTypeChange={setShapeType}
              shapeColor={shapeColor}
              onShapeColorChange={setShapeColor}
              shapeStrokeWidth={shapeStrokeWidth}
              onShapeStrokeWidthChange={setShapeStrokeWidth}
              canUndo={activeHistory?.canUndo ?? false}
              canRedo={activeHistory?.canRedo ?? false}
              onUndo={() => getActivePageHandle()?.undo()}
              onRedo={() => getActivePageHandle()?.redo()}
              onFitToScreen={() => getActivePageHandle()?.fitToScreen()}
              aiOpen={aiOpen}
              onToggleAi={toggleAi}
            />
          </div>
        </div>

        {/* Assombrissement léger du canvas quand le panneau IA est ouvert —
            purement décoratif (pointer-events-none : ne bloque jamais le
            dessin), pour un déplacement de profondeur cohérent avec le
            glissement du panneau plutôt qu'un canvas qui reste au même
            plan visuel une fois le panneau ouvert. */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 z-20 bg-black/[0.04] transition-opacity duration-500 ${
            aiOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Panneau IA — recouvre le bord droit du canvas sans jamais changer
            ses dimensions (position absolute), pour ne rien toucher au
            calcul de zoom/ajustement du canvas. */}
        {auth && (
          <aside
            className={`ai-panel-transition absolute right-0 top-0 z-30 h-full w-full max-w-[420px] border-l border-border shadow-[var(--shadow-lg)] transition-[transform,opacity] duration-[450ms] ${
              aiOpen ? "translate-x-0 scale-100 opacity-100" : "translate-x-full scale-[0.97] opacity-80"
            }`}
            style={{ transitionTimingFunction: "var(--ease-panel)" }}
          >
            <AiPanel
              subscriptionStatus={auth.subscriptionStatus}
              subscriptionTier={auth.subscriptionTier}
              subscriptionProvider={auth.subscriptionProvider}
              generationsUsed={auth.generationsUsed}
              checkoutStatus={checkoutStatus}
              onClose={() => setAiOpen(false)}
            />
          </aside>
        )}
      </div>

      {sheetPanelOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSheetPanelOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSheetPanelOpen(false)}
                aria-label="Fermer"
                className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted transition hover:text-foreground"
              >
                ×
              </button>
            </div>
            <SheetSelector
              sheetType={sheetType}
              onSheetTypeChange={setSheetType}
              paperSize={paperSize}
              onPaperSizeChange={setPaperSize}
              backgroundColor={backgroundColor}
              onBackgroundColorChange={setBackgroundColor}
            />
          </div>
        </div>
      )}
    </div>
  );
}
