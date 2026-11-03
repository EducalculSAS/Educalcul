"use client";
 

import { type Block, type Page } from "@/components/admin/ExerciseBuilder";

type NumberLinePointEditorProps = {
  block: Block;
  updateBlock: (pageId: string, blockId: string, updates: Partial<Block>) => void;
  page: Page;
};

export default function NumberLinePointEditor(props: NumberLinePointEditorProps) {
  const { block, updateBlock, page } = props;
  return (
    <div className="grid grid-cols-2 gap-3">
    <div>
      <label className="text-xs text-gray-500">Minimum</label>
      <input
        type="number"
        value={block.numberLineMin ?? 0}
        onChange={(e) => updateBlock(page.id, block.id, { numberLineMin: parseFloat(e.target.value) || 0 })}
        className="w-full border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
      />
    </div>
    <div>
      <label className="text-xs text-gray-500">Maximum</label>
      <input
        type="number"
        value={block.numberLineMax ?? 10}
        onChange={(e) => updateBlock(page.id, block.id, { numberLineMax: parseFloat(e.target.value) || 0 })}
        className="w-full border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
      />
    </div>
    <div>
      <label className="text-xs text-gray-500">Pas de graduation</label>
      <input
        type="number"
        value={block.numberLineStep ?? 1}
        onChange={(e) => updateBlock(page.id, block.id, { numberLineStep: parseFloat(e.target.value) || 1 })}
        className="w-full border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
      />
    </div>
    <div>
      <label className="text-xs text-gray-500">Valeur correcte</label>
      <input
        type="text"
        value={typeof block.correctAnswer === "string" ? block.correctAnswer : ""}
        onChange={(e) => updateBlock(page.id, block.id, { correctAnswer: e.target.value })}
        className="w-full border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
        placeholder="ex: 0.75"
      />
    </div>
  </div>
  );
}
