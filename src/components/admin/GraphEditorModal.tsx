"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { buildGraphSvg } from "@/lib/mathGraph";
import GlassButton from "@/components/ui/GlassButton";

export default function GraphEditorModal({
  isOpen,
  onClose,
  onInsert,
}: {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (html: string) => void;
}) {
  const [expr, setExpr] = useState("x^2");
  const [xMin, setXMin] = useState(-5);
  const [xMax, setXMax] = useState(5);

  const { svg, error } = useMemo(() => buildGraphSvg(expr, xMin, xMax), [expr, xMin, xMax]);

  if (!isOpen) return null;

  const handleInsert = () => {
    if (!svg) return;
    const html = `<div class="math-graph" data-function="f(x) = ${expr}">${svg}</div>`;
    onInsert(html);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">Insérer un graphique</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 uppercase">Fonction f(x) =</label>
          <input
            type="text"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            placeholder="ex: x^2 - 2*x + 1"
            className="w-full border-[rgba(197,161,72,0.25)] rounded-lg text-sm px-3 py-2"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 uppercase">x min</label>
              <input
                type="number"
                value={xMin}
                onChange={(e) => setXMin(Number(e.target.value))}
                className="w-full border-[rgba(197,161,72,0.25)] rounded-lg text-sm px-3 py-2"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 uppercase">x max</label>
              <input
                type="number"
                value={xMax}
                onChange={(e) => setXMax(Number(e.target.value))}
                className="w-full border-[rgba(197,161,72,0.25)] rounded-lg text-sm px-3 py-2"
              />
            </div>
          </div>
        </div>

        <div className="border border-[rgba(197,161,72,0.2)] rounded-lg p-2 bg-gray-50">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Aperçu</span>
          {error ? (
            <p className="text-xs text-red-500 p-2">{error}</p>
          ) : (
            <div className="math-graph" dangerouslySetInnerHTML={{ __html: svg }} />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <GlassButton size="sm" variant="ghost" onClick={onClose}>
            Annuler
          </GlassButton>
          <GlassButton size="sm" variant="navy" onClick={handleInsert} disabled={!svg}>
            Insérer
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
