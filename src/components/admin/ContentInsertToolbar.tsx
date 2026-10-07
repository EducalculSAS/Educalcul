"use client";

import { useMemo, useState } from "react";
import { Table2, LineChart, Shapes, Pencil, X } from "lucide-react";
import TableEditorModal from "./TableEditorModal";
import GraphEditorModal from "./GraphEditorModal";
import SpecialBlockEditorModal from "./SpecialBlockEditorModal";
import { decodeJsxSpec } from "@/lib/jsxFigure";

const FIGURE_RE = /<figure class="course-figure course-figure-jsx">[\s\S]*?<\/figure>/g;

/** Les figures libres déjà présentes dans un contenu (leur spécification est dans l'attribut data-jsx-spec). */
function findFigures(content: string) {
  const out: { html: string; caption: string; data: Record<string, unknown> }[] = [];
  for (const match of content.matchAll(FIGURE_RE)) {
    const attr = /data-jsx-spec="([^"]*)"/.exec(match[0])?.[1];
    const spec = decodeJsxSpec(attr ? attr.replace(/&quot;/g, '"').replace(/&amp;/g, "&") : null);
    if (!spec) continue;
    const { type: _type, ...data } = spec;
    void _type;
    out.push({ html: match[0], caption: spec.caption, data });
  }
  return out;
}

export default function ContentInsertToolbar({
  onInsert,
  level,
  content,
  onReplace,
}: {
  onInsert: (html: string) => void;
  level?: string;
  /** Contenu actuel : permet de retrouver les figures déjà insérées pour les modifier ou les retirer. */
  content?: string;
  onReplace?: (next: string) => void;
}) {
  const [showTable, setShowTable] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [showFigure, setShowFigure] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const figures = useMemo(() => (content ? findFigures(content) : []), [content]);
  const editedFigure = editing !== null ? figures[editing] : undefined;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowTable(true)}
          className="px-2 py-1 text-xs rounded-lg border border-[rgba(197,161,72,0.3)] text-gray-500 hover:bg-amber-50 flex items-center gap-1"
        >
          <Table2 size={12} /> Tableau
        </button>
        <button
          type="button"
          onClick={() => setShowGraph(true)}
          className="px-2 py-1 text-xs rounded-lg border border-[rgba(197,161,72,0.3)] text-gray-500 hover:bg-amber-50 flex items-center gap-1"
        >
          <LineChart size={12} /> Graphique
        </button>
        <button
          type="button"
          onClick={() => setShowFigure(true)}
          className="px-2 py-1 text-xs rounded-lg border border-[rgba(197,161,72,0.3)] text-gray-600 hover:bg-amber-50 flex items-center gap-1 font-medium"
        >
          <Shapes size={12} /> Figure
        </button>
        {figures.map((figure, index) => (
          <span key={index} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-[11px] rounded-lg bg-amber-50 border border-[rgba(197,161,72,0.3)] text-gray-600">
            Figure {index + 1}{figure.caption ? ` : ${figure.caption.slice(0, 24)}` : ""}
            <button type="button" aria-label="Modifier la figure" className="p-0.5 hover:text-blue-600" onClick={() => setEditing(index)}><Pencil size={11} /></button>
            <button
              type="button"
              aria-label="Retirer la figure"
              className="p-0.5 hover:text-red-600"
              onClick={() => content && onReplace?.(content.replace(figure.html, ""))}
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>

      <TableEditorModal
        isOpen={showTable}
        onClose={() => setShowTable(false)}
        onInsert={(html) => onInsert(html)}
        level={level}
      />
      <GraphEditorModal
        isOpen={showGraph}
        onClose={() => setShowGraph(false)}
        onInsert={(html) => onInsert(html)}
      />
      {showFigure && (
        <SpecialBlockEditorModal
          isOpen
          onlyFigure
          onClose={() => setShowFigure(false)}
          onInsert={(html) => onInsert(html)}
        />
      )}
      {editedFigure && (
        <SpecialBlockEditorModal
          isOpen
          onlyFigure
          initialType="jsx_figure"
          initialData={editedFigure.data}
          onClose={() => setEditing(null)}
          onInsert={(html) => content && onReplace?.(content.replace(editedFigure.html, html))}
        />
      )}
    </>
  );
}
