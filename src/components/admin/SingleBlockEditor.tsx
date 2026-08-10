"use client";

import { useState } from "react";
import { renderLatexInHTML } from "@/lib/katexLoader";
import { renderMathGraphPlaceholders } from "@/lib/mathGraph";
import TableEditorModal from "./TableEditorModal";
import GraphEditorModal from "./GraphEditorModal";

export default function SingleBlockEditor({
  type,
  content,
  onChange,
}: {
  type: "table" | "graph";
  content: string;
  onChange: (html: string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-2">
      {content?.trim() ? (
        <div
          className="latex-content border border-[rgba(197,161,72,0.15)] rounded-lg p-3 bg-gray-50 overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: renderLatexInHTML(renderMathGraphPlaceholders(content || "")) }}
        />
      ) : (
        <p className="text-sm text-gray-400 italic">
          {type === "table" ? "Aucun tableau défini." : "Aucun graphique défini."}
        </p>
      )}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="px-3 py-1.5 text-xs rounded-lg border border-[rgba(197,161,72,0.3)] text-gray-600 hover:bg-amber-50 font-medium"
      >
        {content?.trim()
          ? type === "table" ? "Modifier le tableau" : "Modifier le graphique"
          : type === "table" ? "Créer un tableau" : "Créer un graphique"}
      </button>

      {modalOpen && type === "table" && (
        <TableEditorModal
          isOpen={true}
          onClose={() => setModalOpen(false)}
          onInsert={(html) => onChange(html)}
        />
      )}

      {modalOpen && type === "graph" && (
        <GraphEditorModal
          isOpen={true}
          onClose={() => setModalOpen(false)}
          onInsert={(html) => onChange(html)}
        />
      )}
    </div>
  );
}
