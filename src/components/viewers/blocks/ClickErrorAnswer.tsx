"use client";
 
import type { AnswerValue } from "@/types/answers";
import { renderLatexInHTML } from "@/lib/katexLoader";
import { type Block } from "@/components/admin/ExerciseBuilder";
import { type RevealInfo } from "@/components/viewers/ExerciseViewer";

type ClickErrorAnswerProps = {
  block: Block;
  answer: AnswerValue;
  isSubmitted: boolean;
  revealed: Record<string, RevealInfo>;
  handleBlockAnswerChange: (blockId: string, value: AnswerValue) => void;
};

export default function ClickErrorAnswer(props: ClickErrorAnswerProps) {
  const { block, answer, isSubmitted, revealed, handleBlockAnswerChange } = props;
  return (
    <div className="space-y-2">
    {(block.steps || []).map((step, i) => {
      const selected = answer === i;
      let cls = selected
        ? "border-[var(--greek-blue)] bg-[var(--greek-blue)]/5"
        : "border-gray-200 bg-white hover:border-[var(--greek-blue)]";
      if (isSubmitted) {
        const correctIdx = parseInt(String(revealed[block.id]?.correctAnswer ?? ""), 10);
        if (i === correctIdx) cls = "border-green-500 bg-green-50";
        else if (selected) cls = "border-red-500 bg-red-50";
        else cls = "border-gray-200 bg-white opacity-60";
      }
      return (
        <button
          key={i}
          type="button"
          disabled={isSubmitted}
          onClick={() => handleBlockAnswerChange(block.id, i)}
          className={`w-full text-left px-3 py-2.5 rounded-lg border-2 text-sm font-mono transition-colors disabled:cursor-not-allowed ${cls}`}
        >
          <span dangerouslySetInnerHTML={{ __html: renderLatexInHTML(step) }} />
        </button>
      );
    })}
  </div>
  );
}
