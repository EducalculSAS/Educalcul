"use client";
 
import GlassIconButton from "@/components/ui/GlassIconButton";
import { Trash2, Plus } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import { type Block, type Page } from "@/components/admin/ExerciseBuilder";

type CategorizeEditorProps = {
  block: Block;
  updateBlock: (pageId: string, blockId: string, updates: Partial<Block>) => void;
  page: Page;
};

export default function CategorizeEditor(props: CategorizeEditorProps) {
  const { block, updateBlock, page } = props;
  return (
    <div className="space-y-3">
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Catégories</label>
      {(block.categories || []).map((cat, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={cat}
            onChange={(e) => {
              const oldName = cat;
              const nextCats = [...(block.categories || [])];
              nextCats[i] = e.target.value;
              const nextItems = (block.categoryItems || []).map((it) =>
                it.category === oldName ? { ...it, category: e.target.value } : it
              );
              updateBlock(page.id, block.id, { categories: nextCats, categoryItems: nextItems });
            }}
            className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
            placeholder="Nom de la catégorie"
          />
          <GlassIconButton
            icon={Trash2}
            disabled={(block.categories?.length || 0) <= 2}
            onClick={() => {
              const removed = cat;
              const nextCats = (block.categories || []).filter((_, j) => j !== i);
              const nextItems = (block.categoryItems || []).filter((it) => it.category !== removed);
              updateBlock(page.id, block.id, { categories: nextCats, categoryItems: nextItems });
            }}
            color="red"
            size="sm"
            aria-label="Supprimer cette catégorie"
          />
        </div>
      ))}
      <GlassButton
        size="sm"
        variant="ghost"
        disabled={(block.categories?.length || 0) >= 4}
        onClick={() =>
          updateBlock(page.id, block.id, {
            categories: [...(block.categories || []), `Catégorie ${(block.categories?.length || 0) + 1}`],
          })
        }
      >
        <Plus size={14} /> Ajouter une catégorie (max 4)
      </GlassButton>
    </div>
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Éléments à classer</label>
      {(block.categoryItems || []).map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={item.text}
            onChange={(e) => {
              const next = [...(block.categoryItems || [])];
              next[i] = { ...next[i], text: e.target.value };
              updateBlock(page.id, block.id, { categoryItems: next });
            }}
            className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
            placeholder="Élément"
          />
          <select
            value={item.category}
            onChange={(e) => {
              const next = [...(block.categoryItems || [])];
              next[i] = { ...next[i], category: e.target.value };
              updateBlock(page.id, block.id, { categoryItems: next });
            }}
            className="border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
          >
            {(block.categories || []).map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <GlassIconButton
            icon={Trash2}
            onClick={() => {
              const next = (block.categoryItems || []).filter((_, j) => j !== i);
              updateBlock(page.id, block.id, { categoryItems: next });
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
            categoryItems: [
              ...(block.categoryItems || []),
              { text: "", category: (block.categories || [])[0] || "" },
            ],
          })
        }
      >
        <Plus size={14} /> Ajouter un élément
      </GlassButton>
    </div>
  </div>
  );
}
