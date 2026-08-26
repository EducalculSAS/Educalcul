"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  Image as ImageIcon,
  Table2,
  LineChart,
  PencilLine,
  Type,
  Upload,
  XCircle,
  Sparkles,
} from "lucide-react";
import { renderLatexInHTML } from "@/lib/katexLoader";
import { renderMathGraphPlaceholders } from "@/lib/mathGraph";
import { migrateLessonToBlocks, deriveLegacyFields, LessonBlock } from "@/lib/lessonBlocks";
import type { Lesson, Exercise } from "./CourseBuilder";
import TableEditorModal from "./TableEditorModal";
import GraphEditorModal from "./GraphEditorModal";
import SpecialBlockEditorModal from "./SpecialBlockEditorModal";
import { useDragAutoScroll } from "@/lib/useDragAutoScroll";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";

const BLOCK_LABELS: Record<LessonBlock["type"], string> = {
  text: "Texte",
  table: "Tableau",
  graph: "Graphique",
  image: "Image",
  exercise: "Mini-exercice",
  special: "Bloc spécial",
};

const BLOCK_ICONS: Record<LessonBlock["type"], any> = {
  text: Type,
  table: Table2,
  graph: LineChart,
  image: ImageIcon,
  exercise: PencilLine,
  special: Sparkles,
};

export default function LessonContentEditor({
  lesson,
  onUpdate,
  uploadingLesson,
  onImageUpload,
}: {
  lesson: Lesson;
  onUpdate: (updates: Partial<Lesson>) => void;
  uploadingLesson: string | null;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>, blockId: string) => void;
}) {
  const [draggedBlock, setDraggedBlock] = useState<number | null>(null);
  const [tableModalFor, setTableModalFor] = useState<string | null>(null);
  const [graphModalFor, setGraphModalFor] = useState<string | null>(null);
  const [specialModalFor, setSpecialModalFor] = useState<string | null>(null);
  useDragAutoScroll(draggedBlock !== null);

  // Lazily migrate legacy content/image_url/exercises into blocks on first render
  useEffect(() => {
    if (!lesson.blocks || lesson.blocks.length === 0) {
      onUpdate({ blocks: migrateLessonToBlocks(lesson) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blocks = lesson.blocks || [];

  const setBlocks = (newBlocks: LessonBlock[]) => {
    onUpdate({ blocks: newBlocks, ...deriveLegacyFields(newBlocks) });
  };

  const updateBlock = (id: string, updates: Partial<LessonBlock>) => {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
  };

  const moveBlock = (from: number, to: number) => {
    if (from === to || to < 0 || to >= blocks.length) return;
    const copy = [...blocks];
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    setBlocks(copy);
  };

  const addBlock = (type: LessonBlock["type"]) => {
    if (type === "table") {
      setTableModalFor("__new__");
      return;
    }
    if (type === "graph") {
      setGraphModalFor("__new__");
      return;
    }
    if (type === "special") {
      setSpecialModalFor("__new__");
      return;
    }
    const newBlock: LessonBlock = { id: crypto.randomUUID(), type };
    if (type === "text") newBlock.content = "";
    if (type === "exercise") {
      newBlock.exercise = {
        id: crypto.randomUUID(),
        question: "",
        type: "short_answer",
        answer: "",
        hint: "",
      };
    }
    setBlocks([...blocks, newBlock]);
  };

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        const Icon = BLOCK_ICONS[block.type];
        return (
          <div
            key={block.id}
            draggable
            onDragStart={() => setDraggedBlock(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedBlock !== null) moveBlock(draggedBlock, index);
              setDraggedBlock(null);
            }}
            onDragEnd={() => setDraggedBlock(null)}
            className={`bg-white border border-[rgba(197,161,72,0.25)] rounded-lg p-3 space-y-2 transition-opacity ${
              draggedBlock === index ? "opacity-40" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500" title="Glisser pour réordonner">
                <GripVertical size={16} />
              </div>
              <Icon size={14} className="text-gray-400" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {BLOCK_LABELS[block.type]}
              </span>
              <div className="flex-1" />
              <GlassIconButton
                icon={Trash2}
                onClick={() => removeBlock(block.id)}
                color="red"
                size="sm"
                aria-label="Supprimer le bloc"
              />
            </div>

            {block.type === "text" && (
              <div className="space-y-2">
                <textarea
                  value={block.content || ""}
                  onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                  className="w-full min-h-[100px] p-3 border border-[rgba(197,161,72,0.25)] rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm resize-y overflow-x-auto break-words"
                  placeholder="Contenu du cours (HTML/Markdown supporté)..."
                />
                {block.content?.trim() && (
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Aperçu</span>
                    <div
                      className="latex-content border border-[rgba(197,161,72,0.15)] rounded-lg p-3 bg-gray-50 overflow-x-auto"
                      dangerouslySetInnerHTML={{
                        __html: renderLatexInHTML(renderMathGraphPlaceholders(block.content || "")),
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {(block.type === "table" || block.type === "graph") && (
              <div className="space-y-2">
                <div
                  className="latex-content border border-[rgba(197,161,72,0.15)] rounded-lg p-3 bg-gray-50 overflow-x-auto"
                  dangerouslySetInnerHTML={{
                    __html: renderLatexInHTML(renderMathGraphPlaceholders(block.content || "")),
                  }}
                />
                <GlassButton
                  size="sm"
                  variant="ghost"
                  onClick={() => (block.type === "table" ? setTableModalFor(block.id) : setGraphModalFor(block.id))}
                >
                  Modifier
                </GlassButton>
              </div>
            )}

            {block.type === "image" && (
              <div>
                {block.image_url ? (
                  <div className="relative w-full max-w-xs">
                    <img
                      src={block.image_url}
                      alt="Illustration"
                      className="w-full h-32 object-cover rounded-lg border border-[rgba(197,161,72,0.25)]"
                    />
                    <GlassIconButton
                      icon={XCircle}
                      onClick={() => updateBlock(block.id, { image_url: "" })}
                      color="red"
                      size="sm"
                      aria-label="Supprimer l'image"
                      className="absolute top-1.5 right-1.5"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-dashed border-[rgba(197,161,72,0.4)] rounded-lg text-xs text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors w-fit">
                      <Upload size={14} />
                      {uploadingLesson === block.id ? "Upload..." : "Choisir une image"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingLesson === block.id}
                        onChange={(e) => onImageUpload(e, block.id)}
                      />
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">ou</span>
                      <input
                        type="url"
                        placeholder="Coller un lien d'image (https://...)"
                        className="flex-1 text-xs px-2 py-1.5 border border-[rgba(197,161,72,0.25)] rounded-lg"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const value = (e.target as HTMLInputElement).value.trim();
                            if (value) updateBlock(block.id, { image_url: value });
                          }
                        }}
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (value) updateBlock(block.id, { image_url: value });
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {block.type === "special" && (
              <div className="space-y-2">
                <div
                  className="latex-content border border-[rgba(197,161,72,0.15)] rounded-lg p-3 bg-gray-50 overflow-x-auto"
                  dangerouslySetInnerHTML={{
                    __html: renderLatexInHTML(renderMathGraphPlaceholders(block.content || "")),
                  }}
                />
                <GlassButton size="sm" variant="ghost" onClick={() => setSpecialModalFor(block.id)}>
                  Modifier
                </GlassButton>
              </div>
            )}

            {block.type === "exercise" && block.exercise && (
              <div className="space-y-2">
                <textarea
                  value={block.exercise.question}
                  onChange={(e) =>
                    updateBlock(block.id, { exercise: { ...block.exercise!, question: e.target.value } })
                  }
                  className="w-full min-h-[50px] p-2 border border-[rgba(197,161,72,0.25)] rounded-lg text-sm resize-y"
                  placeholder="Énoncé de la question..."
                />
                <input
                  type="text"
                  value={block.exercise.answer}
                  onChange={(e) =>
                    updateBlock(block.id, { exercise: { ...block.exercise!, answer: e.target.value } })
                  }
                  className="w-full p-2 border border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                  placeholder="Réponse attendue (utilisée pour la correction par l'IA)"
                />
                <input
                  type="text"
                  value={block.exercise.hint || ""}
                  onChange={(e) =>
                    updateBlock(block.id, { exercise: { ...block.exercise!, hint: e.target.value } })
                  }
                  className="w-full p-2 border border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                  placeholder="Indice (optionnel)"
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Add block toolbar */}
      <div className="flex flex-wrap gap-2">
        <GlassButton size="sm" variant="outline" onClick={() => addBlock("text")}>
          <Plus size={14} /> Texte
        </GlassButton>
        <GlassButton size="sm" variant="outline" onClick={() => addBlock("table")}>
          <Plus size={14} /> Tableau
        </GlassButton>
        <GlassButton size="sm" variant="outline" onClick={() => addBlock("graph")}>
          <Plus size={14} /> Graphique
        </GlassButton>
        <GlassButton size="sm" variant="outline" onClick={() => addBlock("image")}>
          <Plus size={14} /> Image
        </GlassButton>
        <GlassButton size="sm" variant="outline" onClick={() => addBlock("exercise")}>
          <Plus size={14} /> Mini-exercice
        </GlassButton>
        <GlassButton size="sm" variant="outline" onClick={() => addBlock("special")}>
          <Plus size={14} /> Bloc spécial
        </GlassButton>
      </div>

      {tableModalFor !== null && (
        <TableEditorModal
          isOpen={true}
          onClose={() => setTableModalFor(null)}
          onInsert={(html) => {
            if (tableModalFor === "__new__") {
              setBlocks([...blocks, { id: crypto.randomUUID(), type: "table", content: html }]);
            } else {
              updateBlock(tableModalFor, { content: html });
            }
          }}
        />
      )}

      {graphModalFor !== null && (
        <GraphEditorModal
          isOpen={true}
          onClose={() => setGraphModalFor(null)}
          onInsert={(html) => {
            if (graphModalFor === "__new__") {
              setBlocks([...blocks, { id: crypto.randomUUID(), type: "graph", content: html }]);
            } else {
              updateBlock(graphModalFor, { content: html });
            }
          }}
        />
      )}

      {specialModalFor !== null && (
        <SpecialBlockEditorModal
          isOpen={true}
          onClose={() => setSpecialModalFor(null)}
          initialType={
            specialModalFor !== "__new__" ? blocks.find((b) => b.id === specialModalFor)?.specialType : undefined
          }
          initialData={
            specialModalFor !== "__new__" ? blocks.find((b) => b.id === specialModalFor)?.specialData : undefined
          }
          onInsert={(html, specialType, specialData) => {
            if (specialModalFor === "__new__") {
              setBlocks([...blocks, { id: crypto.randomUUID(), type: "special", content: html, specialType, specialData }]);
            } else {
              updateBlock(specialModalFor, { content: html, specialType, specialData });
            }
          }}
        />
      )}
    </div>
  );
}
