"use client";

import { useState } from "react";
import { Table2, LineChart } from "lucide-react";
import TableEditorModal from "./TableEditorModal";
import GraphEditorModal from "./GraphEditorModal";

export default function ContentInsertToolbar({
  onInsert,
  level,
}: {
  onInsert: (html: string) => void;
  level?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const [showGraph, setShowGraph] = useState(false);

  return (
    <>
      <div className="flex gap-2">
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
    </>
  );
}
