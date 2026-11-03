"use client";
 
import GlassIconButton from "@/components/ui/GlassIconButton";
import { Trash2, Plus } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import { type Block, type Page } from "@/components/admin/ExerciseBuilder";

type FillBlankEditorProps = {
  block: Block;
  updateBlock: (pageId: string, blockId: string, updates: Partial<Block>) => void;
  page: Page;
};

export default function FillBlankEditor(props: FillBlankEditorProps) {
  const { block, updateBlock, page } = props;
  return (
    <div className="space-y-2">
    <label className="text-sm font-medium text-gray-700">
      Réponses attendues (une par trou, dans l&apos;ordre)
    </label>
    {(block.blanks || []).map((blank, i) => (
      <div key={i} className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-400 w-6">{`{{${i + 1}}}`}</span>
        <input
          type="text"
          value={blank}
          onChange={(e) => {
            const next = [...(block.blanks || [])];
            next[i] = e.target.value;
            updateBlock(page.id, block.id, { blanks: next });
          }}
          className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
          placeholder="Réponse attendue (alternatives séparées par |)"
        />
        <GlassIconButton
          icon={Trash2}
          onClick={() => {
            const next = (block.blanks || []).filter((_, j) => j !== i);
            updateBlock(page.id, block.id, { blanks: next });
          }}
          color="red"
          size="sm"
          aria-label="Supprimer ce trou"
        />
      </div>
    ))}
    <GlassButton
      size="sm"
      variant="ghost"
      onClick={() =>
        updateBlock(page.id, block.id, {
          blanks: [...(block.blanks || []), ""],
        })
      }
    >
      <Plus size={14} /> Ajouter un trou
    </GlassButton>
  </div>
  );
}
