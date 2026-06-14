"use client";

import { useState, useEffect, useRef } from "react";
import { Eraser, Undo2, Trash2 } from "lucide-react";

const COLORS = ["#000000", "#ef4444", "#3b82f6", "#22c55e", "#c5a148"];

export default function DrawingCanvas({
  onChange,
  disabled,
  initialData,
}: {
  onChange: (data: string) => void;
  disabled: boolean;
  initialData?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const [penColor, setPenColor] = useState("#000000");
  const penColorRef = useRef(penColor);
  penColorRef.current = penColor;
  const historyRef = useRef<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const strokeMovedRef = useRef(false);
  const lastTapTimeRef = useRef(0);
  // Une fois qu'un stylet (Apple Pencil) a été utilisé, on ignore le tactile
  // (doigt/paume) pour éviter que la main posée sur l'écran ne dessine.
  const penUsedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#000000";
    context.lineWidth = 2;
    setCtx(context);

    // Fond blanc initial (évite un fond transparent)
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (initialData && initialData.startsWith("data:image")) {
      const img = new Image();
      img.onload = () => {
        context.drawImage(img, 0, 0);
      };
      img.src = initialData;
    }
  }, []); // Au montage uniquement

  const pushHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    historyRef.current.push(canvas.toDataURL("image/png"));
    if (historyRef.current.length > 30) historyRef.current.shift();
    setCanUndo(true);
  };

  // Convertit des coordonnées écran (CSS px) en coordonnées internes du canvas.
  const getCoordinates = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Épaisseur du trait selon la pression du stylet (sensibilité à l'appui).
  const lineWidthFor = (pressure: number) => {
    if (toolRef.current === "eraser") return 24;
    const p = pressure > 0 ? pressure : 0.5; // souris/doigt : pression neutre
    return 1 + p * 2.8; // ~1 (léger) à ~3.8 (appuyé)
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || !ctx || !canvasRef.current) return;
    // Rejet de la paume : on ignore le tactile si un stylet est en usage.
    if (e.pointerType === "touch" && penUsedRef.current) return;
    if (e.pointerType === "pen") penUsedRef.current = true;

    e.preventDefault();
    try {
      canvasRef.current.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const { x, y } = getCoordinates(e.clientX, e.clientY);
    lastPointRef.current = { x, y };
    isDrawingRef.current = true;
    strokeMovedRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawingRef.current || disabled || !ctx) return;
    e.preventDefault();

    // Premier déplacement du trait : on sauvegarde pour pouvoir annuler.
    if (!strokeMovedRef.current) {
      strokeMovedRef.current = true;
      pushHistory();
    }

    ctx.strokeStyle = toolRef.current === "eraser" ? "#FFFFFF" : penColorRef.current;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // getCoalescedEvents() renvoie TOUS les points intermédiaires que le
    // navigateur a regroupés : indispensable pour que les traits rapides du
    // stylet ne « sautent » pas (sinon ça écrit pas / ça fait des angles).
    const native = e.nativeEvent as PointerEvent;
    const events: PointerEvent[] =
      typeof native.getCoalescedEvents === "function"
        ? native.getCoalescedEvents()
        : [native];

    for (const ev of events) {
      const { x, y } = getCoordinates(ev.clientX, ev.clientY);
      const prev = lastPointRef.current;
      if (!prev) {
        lastPointRef.current = { x, y };
        continue;
      }
      ctx.lineWidth = lineWidthFor(ev.pressure);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      lastPointRef.current = { x, y };
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (disabled || !canvasRef.current) return;
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    try {
      canvasRef.current.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (strokeMovedRef.current) {
      // Vrai trait dessiné
      onChange(canvasRef.current.toDataURL("image/png"));
    } else {
      // Aucun déplacement = simple tap. Deux taps rapides = double-tap :
      // on change d'outil (stylo ↔ gomme), comme le double-tap de l'Apple Pencil.
      const now = Date.now();
      if (now - lastTapTimeRef.current < 320) {
        setTool((t) => (t === "pen" ? "eraser" : "pen"));
        lastTapTimeRef.current = 0;
      } else {
        lastTapTimeRef.current = now;
      }
    }
    lastPointRef.current = null;
  };

  const undo = () => {
    if (disabled || !ctx || !canvasRef.current) return;
    const last = historyRef.current.pop();
    if (!last) return;
    setCanUndo(historyRef.current.length > 0);
    const canvas = canvasRef.current;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      onChange(canvas.toDataURL("image/png"));
    };
    img.src = last;
  };

  const clearCanvas = () => {
    if (disabled || !ctx || !canvasRef.current) return;
    pushHistory();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    onChange("");
  };

  return (
    <div className="relative border border-[var(--greek-gold)] overflow-hidden bg-white select-none">
      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        className="w-full h-[300px] touch-none select-none cursor-crosshair bg-white"
        style={{ touchAction: "none", WebkitUserSelect: "none", userSelect: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      {!disabled && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5 p-1 bg-white/80 rounded-full shadow border border-[rgba(197,161,72,0.3)]">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setPenColor(c);
                setTool("pen");
              }}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${
                tool === "pen" && penColor === c
                  ? "border-[var(--greek-blue)] scale-110"
                  : "border-white"
              }`}
              style={{ backgroundColor: c }}
              title="Couleur"
            />
          ))}
        </div>
      )}
      {!disabled && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <button
            onClick={() => setTool((t) => (t === "pen" ? "eraser" : "pen"))}
            className={`p-2 rounded-full shadow border transition-colors ${
              tool === "eraser"
                ? "bg-[var(--greek-blue)] border-[var(--greek-blue)] text-white"
                : "bg-white/80 border-[rgba(197,161,72,0.3)] text-[var(--text-dark)] hover:bg-[var(--greek-gold)]/10"
            }`}
            title={tool === "eraser" ? "Repasser en stylo" : "Gomme (ou double-tap au stylet)"}
          >
            <Eraser className="w-4 h-4" />
          </button>
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-2 bg-white/80 rounded-full shadow border border-[rgba(197,161,72,0.3)] text-[var(--text-dark)] hover:bg-[var(--greek-gold)]/10 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Annuler le dernier trait"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={clearCanvas}
            className="p-2 bg-white/80 rounded-full shadow hover:bg-red-50 text-red-500 border border-red-200"
            title="Effacer tout"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
