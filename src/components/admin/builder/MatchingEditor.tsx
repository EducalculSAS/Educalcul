"use client";
 
import { ArrowRightLeft, Trash2, Plus } from "lucide-react";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassButton from "@/components/ui/GlassButton";
import { type Block, type Page } from "@/components/admin/ExerciseBuilder";

type MatchingEditorProps = {
  block: Block;
  updateBlock: (pageId: string, blockId: string, updates: Partial<Block>) => void;
  page: Page;
};

export default function MatchingEditor(props: MatchingEditorProps) {
  const { block, updateBlock, page } = props;
  return (
    <div className="space-y-2">
    <label className="text-sm font-medium text-gray-700">
      Paires à relier
    </label>
    {(block.pairs || []).map((pair, i) => (
      <div key={i} className="flex items-center gap-2">
        <input
          type="text"
          value={pair.left}
          onChange={(e) => {
            const next = [...(block.pairs || [])];
            next[i] = { ...next[i], left: e.target.value };
            updateBlock(page.id, block.id, { pairs: next });
          }}
          className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
          placeholder="Élément"
        />
        <ArrowRightLeft size={14} className="text-gray-300 shrink-0" />
        <input
          type="text"
          value={pair.right}
          onChange={(e) => {
            const next = [...(block.pairs || [])];
            next[i] = { ...next[i], right: e.target.value };
            updateBlock(page.id, block.id, { pairs: next });
          }}
          className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
          placeholder="Correspondance"
        />
        <GlassIconButton
          icon={Trash2}
          onClick={() => {
            const next = (block.pairs || []).filter((_, j) => j !== i);
            updateBlock(page.id, block.id, { pairs: next });
          }}
          color="red"
          size="sm"
          aria-label="Supprimer cette paire"
        />
      </div>
    ))}
    <GlassButton
      size="sm"
      variant="ghost"
      onClick={() =>
        updateBlock(page.id, block.id, {
          pairs: [...(block.pairs || []), { left: "", right: "" }],
        })
      }
    >
      <Plus size={14} /> Ajouter une paire
    </GlassButton>
  </div>
  );
}
