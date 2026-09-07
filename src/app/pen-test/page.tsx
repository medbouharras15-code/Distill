"use client";

import { useEffect, useRef, useState } from "react";

/** Page de diagnostic TEMPORAIRE — totalement indépendante du moteur
 * Distill (aucun NotesCanvas, aucun zoom, aucun autosave, aucun Supabase,
 * aucun Undo/Redo, aucun touchScrollState, aucun rejet de paume
 * applicatif). Un seul rôle : vérifier si un <canvas> minimal, sans aucune
 * couche de l'éditeur, perd lui aussi des contacts Apple Pencil. */
export default function PenTestPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const countRef = useRef(0);
  const [count, setCount] = useState(0);

  // Diagnostic léger (aucun log, aucun elementFromPoint, aucune mise à jour
  // sur pointermove/touchmove) : compte en parallèle les événements
  // down/up des deux API web, pour voir laquelle voit vraiment le contact
  // quand un trait rapide manque.
  const [pointerDownCount, setPointerDownCount] = useState(0);
  const [pointerUpCount, setPointerUpCount] = useState(0);
  const [touchStartCount, setTouchStartCount] = useState(0);
  const [touchEndCount, setTouchEndCount] = useState(0);

  // Compteur de touchmove filtrés touchType==="stylus" — en ref (pas de
  // setState par événement, touchmove pouvant être très fréquent), affiché
  // en le resynchronisant seulement aux événements de fin de geste déjà
  // existants (touchend/pointerup), jamais pendant le mouvement lui-même.
  const stylusTouchMoveRef = useRef(0);
  const [stylusTouchMoveCount, setStylusTouchMoveCount] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Test A/B (variante filtrée) : preventDefault() uniquement si au moins
    // un des touches actifs a touchType === "stylus" (extension WebKit du
    // Pencil, cousine de force/altitudeAngle/azimuthAngle déjà exposées sur
    // Touch). But : vérifier si le bénéfice observé sans filtrage se
    // maintient une fois restreint au seul Apple Pencil, avant d'envisager
    // une intégration dans NotesCanvas qui ne doit jamais affecter le doigt.
    function handleNativeTouchMove(e: TouchEvent) {
      const hasStylus = Array.from(e.touches).some(
        (t) => (t as Touch & { touchType?: string }).touchType === "stylus",
      );
      if (!hasStylus) return;
      stylusTouchMoveRef.current += 1;
      e.preventDefault();
    }
    canvas.addEventListener("touchmove", handleNativeTouchMove, { passive: false });
    return () => {
      canvas.removeEventListener("touchmove", handleNativeTouchMove);
    };
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    // Compte TOUT pointerdown (pas seulement pen) — le protocole de test
    // étant sans doigt, tout ce qui arrive ici pendant le test vient du
    // Pencil, filtré ou non.
    setPointerDownCount((c) => c + 1);
    if (e.pointerType !== "pen") return;
    countRef.current += 1;
    setCount(countRef.current);
    drawingRef.current = true;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType !== "pen" || !drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const last = lastPosRef.current;
    if (ctx && last) {
      ctx.strokeStyle = "black";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(e.clientX, e.clientY);
      ctx.stroke();
    }
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerEnd(e: React.PointerEvent<HTMLCanvasElement>) {
    // Ce handler sert aussi bien à onPointerUp qu'à onPointerCancel — on ne
    // compte que le vrai "pointerup" (e.type le distingue de "pointercancel").
    if (e.type === "pointerup") setPointerUpCount((c) => c + 1);
    setStylusTouchMoveCount(stylusTouchMoveRef.current);
    if (e.pointerType !== "pen") return;
    drawingRef.current = false;
    lastPosRef.current = null;
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "white",
        // Empêche la sélection de texte native et le menu callout iOS
        // (Copier/Traduire/Rechercher) de se déclencher pendant l'écriture
        // au Pencil — sans ces protections, Safari peut interpréter le
        // contact comme un geste de sélection et voler le pointeur.
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        draggable={false}
        style={{
          touchAction: "none",
          display: "block",
          width: "100%",
          height: "100%",
          WebkitUserSelect: "none",
          userSelect: "none",
          WebkitTouchCallout: "none",
          WebkitTapHighlightColor: "transparent",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onTouchStart={() => setTouchStartCount((c) => c + 1)}
        onTouchEnd={() => {
          setTouchEndCount((c) => c + 1);
          setStylusTouchMoveCount(stylusTouchMoveRef.current);
        }}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
      <div
        style={{
          position: "fixed",
          top: 8,
          left: 8,
          background: "black",
          color: "white",
          padding: "6px 10px",
          borderRadius: 6,
          fontFamily: "monospace",
          fontSize: 14,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>PEN downs reçus : {count}</span>
          <button
            type="button"
            onClick={handleClear}
            style={{ padding: "2px 8px", background: "white", color: "black", borderRadius: 4 }}
          >
            Effacer
          </button>
        </div>
        <div>pointerdown : {pointerDownCount}</div>
        <div>pointerup : {pointerUpCount}</div>
        <div>touchstart : {touchStartCount}</div>
        <div>touchend : {touchEndCount}</div>
        <div>stylus touchmove détectés : {stylusTouchMoveCount}</div>
      </div>
    </div>
  );
}
