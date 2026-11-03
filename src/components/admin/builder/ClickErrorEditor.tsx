"use client";
 
import GlassIconButton from "@/components/ui/GlassIconButton";
import { Trash2, Plus } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import { type Block, type Page } from "@/components/admin/ExerciseBuilder";

type ClickErrorEditorProps = {
  block: Block;
  updateBlock: (pageId: string, blockId: string, updates: Partial<Block>) => void;
  page: Page;
};

export default function ClickErrorEditor(props: ClickErrorEditorProps) {
  const { block, updateBlock, page } = props;
  return (
    <div className="space-y-2">
    <label className="text-sm font-medium text-gray-700">
      Étapes, coche celle qui est FAUSSE
    </label>
    {(block.steps || []).map((step, i) => (
      <div key={i} className="flex items-center gap-2">
        <input
          type="radio"
          name={`click-error-${block.id}`}
          checked={block.correctAnswer === String(i)}
          onChange={() => updateBlock(page.id, block.id, { correctAnswer: String(i) })}
          className="shrink-0"
          aria-label={`Étape ${i + 1} incorrecte`}
        />
        <input
          type="text"
          value={step}
          onChange={(e) => {
            const next = [...(block.steps || [])];
            next[i] = e.target.value;
            updateBlock(page.id, block.id, { steps: next });
          }}
          className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg text-sm font-mono"
          placeholder="Étape du calcul"
        />
        <GlassIconButton
          icon={Trash2}
          onClick={() => {
            const next = (block.steps || []).filter((_, j) => j !== i);
            updateBlock(page.id, block.id, {
              steps: next,
              correctAnswer: block.correctAnswer === String(i) ? "" : block.correctAnswer,
            });
          }}
          color="red"
          size="sm"
          aria-label="Supprimer cette étape"
        />
      </div>
    ))}
    <GlassButton
      size="sm"
      variant="ghost"
      onClick={() => updateBlock(page.id, block.id, { steps: [...(block.steps || []), ""] })}
    >
      <Plus size={14} /> Ajouter une étape
    </GlassButton>
  </div>
  );
}
