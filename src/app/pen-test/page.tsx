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

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
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
    <div style={{ position: "fixed", inset: 0, background: "white" }}>
      <canvas
        ref={canvasRef}
        style={{ touchAction: "none", display: "block", width: "100%", height: "100%" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
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
          alignItems: "center",
          gap: 12,
        }}
      >
        <span>PEN downs reçus : {count}</span>
        <button
          type="button"
          onClick={handleClear}
          style={{ padding: "2px 8px", background: "white", color: "black", borderRadius: 4 }}
        >
          Effacer
        </button>
      </div>
    </div>
  );
}
