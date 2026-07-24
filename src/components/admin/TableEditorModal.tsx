"use client";

import { useState } from "react";
import { X, Plus, Minus, Sparkles, Loader2 } from "lucide-react";
import { renderLatexInHTML } from "@/lib/katexLoader";

type TableType = "value" | "sign" | "variation" | "generic";

const SYMBOLS = ["↗", "↘", "+", "-", "0", "∞", "‖", "∈", "∉", "≤", "≥"];

const TYPE_LABELS: Record<TableType, string> = {
  value: "Tableau de valeurs",
  sign: "Tableau de signes",
  variation: "Tableau de variations",
  generic: "Tableau générique",
};

const DEFAULTS: Record<TableType, { headers: string[]; rows: string[][] }> = {
  value: { headers: ["x", "f(x)"], rows: [["0", ""], ["1", ""]] },
  sign: { headers: ["x", "-∞", "", "+∞"], rows: [["f(x)", "+", "0", "-"]] },
  variation: { headers: ["x", "-∞", "", "+∞"], rows: [["f(x)", "", "↗", ""]] },
  generic: { headers: ["", ""], rows: [["", ""]] },
};

export default function TableEditorModal({
  isOpen,
  onClose,
  onInsert,
  level,
}: {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (html: string) => void;
  level?: string;
}) {
  const [tableType, setTableType] = useState<TableType>("value");
  const [headers, setHeaders] = useState<string[]>(DEFAULTS.value.headers);
  const [rows, setRows] = useState<string[][]>(DEFAULTS.value.rows);
  const [aiDescription, setAiDescription] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  if (!isOpen) return null;

  const changeType = (type: TableType) => {
    setTableType(type);
    setHeaders(DEFAULTS[type].headers);
    setRows(DEFAULTS[type].rows.map((r) => [...r]));
  };

  const updateHeader = (col: number, value: string) => {
    setHeaders((h) => h.map((c, i) => (i === col ? value : c)));
  };

  const updateCell = (row: number, col: number, value: string) => {
    setRows((rs) => rs.map((r, i) => (i === row ? r.map((c, j) => (j === col ? value : c)) : r)));
  };

  const addColumn = () => {
    setHeaders((h) => [...h, ""]);
    setRows((rs) => rs.map((r) => [...r, ""]));
  };

  const removeColumn = () => {
    if (headers.length <= 1) return;
    setHeaders((h) => h.slice(0, -1));
    setRows((rs) => rs.map((r) => r.slice(0, -1)));
  };

  const addRow = () => {
    setRows((rs) => [...rs, headers.map(() => "")]);
  };

  const removeRow = () => {
    setRows((rs) => (rs.length > 1 ? rs.slice(0, -1) : rs));
  };

  const insertSymbol = (row: number, col: number, symbol: string) => {
    updateCell(row, col, (rows[row][col] || "") + symbol);
  };

  const handleAiGenerate = async () => {
    if (!aiDescription.trim()) return;
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/admin/generate-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiDescription, type: tableType, level }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de génération");
      setHeaders(data.headers);
      setRows(data.rows);
    } catch (e: any) {
      setAiError(e.message || "Erreur de génération");
    } finally {
      setAiLoading(false);
    }
  };

  const handleInsert = () => {
    const html =
      `<table class="math-table math-table-${tableType}">\n` +
      `  <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>\n` +
      `  <tbody>\n` +
      rows.map((r) => `    <tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("\n") +
      `\n  </tbody>\n</table>`;
    onInsert(html);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">Insérer un tableau</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Type selector */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TYPE_LABELS) as TableType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => changeType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                tableType === t
                  ? "bg-[var(--greek-blue)] text-white border-[var(--greek-blue)]"
                  : "border-[rgba(197,161,72,0.3)] text-gray-600 hover:bg-amber-50"
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* AI generation */}
        <div className="bg-amber-50/50 border border-[rgba(197,161,72,0.25)] rounded-lg p-3 space-y-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <Sparkles size={14} /> Générer avec l'IA
          </span>
          <div className="flex gap-2">
            <input
              type="text"
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              placeholder="Ex: tableau de signes de (2x-4)(x+1)"
              className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg text-sm px-3 py-1.5"
            />
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={aiLoading || !aiDescription.trim()}
              className="px-3 py-1.5 bg-[var(--greek-gold)] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1"
            >
              {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Générer
            </button>
          </div>
          {aiError && <p className="text-xs text-red-500">{aiError}</p>}
        </div>

        {/* Table grid editor */}
        <div className="overflow-x-auto">
          <table className="border-collapse w-full">
            <thead>
              <tr>
                {headers.map((h, col) => (
                  <th key={col} className="border border-[rgba(197,161,72,0.3)] p-1">
                    <input
                      value={h}
                      onChange={(e) => updateHeader(col, e.target.value)}
                      className="w-full text-center text-sm font-semibold border-0 focus:ring-1 focus:ring-blue-400 rounded"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="border border-[rgba(197,161,72,0.3)] p-1">
                      <input
                        value={cell}
                        onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                        className="w-full text-center text-sm border-0 focus:ring-1 focus:ring-blue-400 rounded"
                      />
                      {(tableType === "sign" || tableType === "variation") && (
                        <div className="flex flex-wrap gap-0.5 mt-1 justify-center">
                          {SYMBOLS.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => insertSymbol(rIdx, cIdx, s)}
                              className="text-[10px] px-1 rounded hover:bg-amber-100 text-gray-500"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Row/column controls */}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={addColumn} className="px-2 py-1 text-xs rounded-lg border border-[rgba(197,161,72,0.3)] hover:bg-amber-50 flex items-center gap-1">
            <Plus size={12} /> Colonne
          </button>
          <button type="button" onClick={removeColumn} className="px-2 py-1 text-xs rounded-lg border border-[rgba(197,161,72,0.3)] hover:bg-amber-50 flex items-center gap-1">
            <Minus size={12} /> Colonne
          </button>
          <button type="button" onClick={addRow} className="px-2 py-1 text-xs rounded-lg border border-[rgba(197,161,72,0.3)] hover:bg-amber-50 flex items-center gap-1">
            <Plus size={12} /> Ligne
          </button>
          <button type="button" onClick={removeRow} className="px-2 py-1 text-xs rounded-lg border border-[rgba(197,161,72,0.3)] hover:bg-amber-50 flex items-center gap-1">
            <Minus size={12} /> Ligne
          </button>
        </div>

        {/* Preview */}
        <div className="border border-[rgba(197,161,72,0.2)] rounded-lg p-2 bg-gray-50">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Aperçu</span>
          <div
            className="latex-content overflow-x-auto"
            dangerouslySetInnerHTML={{
              __html: renderLatexInHTML(
                `<table class="math-table math-table-${tableType}"><thead><tr>${headers
                  .map((h) => `<th>${h}</th>`)
                  .join("")}</tr></thead><tbody>${rows
                  .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
                  .join("")}</tbody></table>`
              ),
            }}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[rgba(197,161,72,0.3)] text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
          <button type="button" onClick={handleInsert} className="px-4 py-2 text-sm rounded-lg bg-[var(--greek-blue)] text-white font-medium hover:opacity-90">
            Insérer
          </button>
        </div>
      </div>
    </div>
  );
}
