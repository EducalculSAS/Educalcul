"use client";
 
import GlassIconButton from "@/components/ui/GlassIconButton";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import { type Block, type Page } from "@/components/admin/ExerciseBuilder";

type OrderingEditorProps = {
  block: Block;
  updateBlock: (pageId: string, blockId: string, updates: Partial<Block>) => void;
  page: Page;
};

export default function OrderingEditor(props: OrderingEditorProps) {
  const { block, updateBlock, page } = props;
  return (
    <div className="space-y-2">
    <label className="text-sm font-medium text-gray-700">
      Éléments, dans leur ordre CORRECT
    </label>
    {(block.items || []).map((item, i) => (
      <div key={i} className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-400 w-5">{i + 1}.</span>
        <input
          type="text"
          value={item}
          onChange={(e) => {
            const next = [...(block.items || [])];
            next[i] = e.target.value;
            updateBlock(page.id, block.id, { items: next });
          }}
          className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
          placeholder="Étape / élément"
        />
        <GlassIconButton
          icon={ArrowUp}
          disabled={i === 0}
          onClick={() => {
            const next = [...(block.items || [])];
            [next[i - 1], next[i]] = [next[i], next[i - 1]];
            updateBlock(page.id, block.id, { items: next });
          }}
          color="navy"
          size="sm"
          aria-label="Monter cet élément"
        />
        <GlassIconButton
          icon={ArrowDown}
          disabled={i === (block.items?.length || 0) - 1}
          onClick={() => {
            const next = [...(block.items || [])];
            [next[i], next[i + 1]] = [next[i + 1], next[i]];
            updateBlock(page.id, block.id, { items: next });
          }}
          color="navy"
          size="sm"
          aria-label="Descendre cet élément"
        />
        <GlassIconButton
          icon={Trash2}
          onClick={() => {
            const next = (block.items || []).filter((_, j) => j !== i);
            updateBlock(page.id, block.id, { items: next });
          }}
          color="red"
          size="sm"
          aria-label="Supprimer cet élément"
        />
      </div>
    ))}
    <GlassButton
      size="sm"
      variant="ghost"
      onClick={() =>
        updateBlock(page.id, block.id, {
          items: [...(block.items || []), ""],
        })
      }
    >
      <Plus size={14} /> Ajouter un élément
    </GlassButton>
  </div>
  );
}
