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
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const [penColor, setPenColor] = useState("#000000");
  const penColorRef = useRef(penColor);
  penColorRef.current = penColor;
  const historyRef = useRef<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);

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

    // Fill with white background initially to prevent transparent background
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Load initial data if it's an image
    if (initialData && initialData.startsWith("data:image")) {
      const img = new Image();
      img.onload = () => {
        context.drawImage(img, 0, 0);
      };
      img.src = initialData;
    }
  }, []); // Only run once on mount

  const pushHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    historyRef.current.push(canvas.toDataURL("image/png"));
    if (historyRef.current.length > 30) historyRef.current.shift();
    setCanUndo(true);
  };

  const startDrawing = (e: any) => {
    if (disabled || !ctx || !canvasRef.current) return;
    pushHistory();
    const { x, y } = getCoordinates(e);
    if (toolRef.current === "eraser") {
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 20;
    } else {
      ctx.strokeStyle = penColorRef.current;
      ctx.lineWidth = 2;
    }
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing || disabled || !ctx || !canvasRef.current) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing || disabled || !ctx || !canvasRef.current) return;
    ctx.closePath();
    setIsDrawing(false);
    onChange(canvasRef.current.toDataURL("image/png"));
  };

  // Convertit les coordonnées de l'événement (CSS px) en coordonnées du canvas
  // (résolution interne) pour éviter le décalage du trait sur mobile/tactile.
  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX: number;
    let clientY: number;
    if (e.nativeEvent instanceof MouseEvent) {
      clientX = e.nativeEvent.clientX;
      clientY = e.nativeEvent.clientY;
    } else {
      const touch = e.nativeEvent.touches[0] || e.nativeEvent.changedTouches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
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
    // Fill with white instead of clearing to transparency
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    onChange("");
  };

  return (
    <div className="relative border border-[var(--greek-gold)] overflow-hidden bg-white">
      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        className="w-full h-[300px] touch-none cursor-crosshair bg-white"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
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
            title={tool === "eraser" ? "Repasser en stylo" : "Gomme"}
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
