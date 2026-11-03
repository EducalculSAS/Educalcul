"use client";
 
import type { AnswerValue } from "@/types/answers";
import { Sparkles } from "lucide-react";
import { type Page, type Block } from "@/components/admin/ExerciseBuilder";

type CodingAnswerProps = {
  isSubmitted: boolean;
  answer: AnswerValue;
  handleBlockAnswerChange: (blockId: string, value: AnswerValue) => void;
  block: Block;
  isCorrect: boolean;
  exercise: { id?: string; title: string; description?: string | null; content_json: Page[] | null; grading_type?: 'auto' | 'ai' | 'manual'; level?: string; type?: string; difficulty_level?: string; course_id?: string | number | null; courses?: { title?: string; subject?: string; level?: string; } | null; min_score_percent?: number | null; max_attempts?: number | null; time_limit_minutes?: number | null; };
};

export default function CodingAnswer(props: CodingAnswerProps) {
  const { isSubmitted, answer, handleBlockAnswerChange, block, isCorrect, exercise } = props;
  return (
    <div className="relative">
    <textarea
      disabled={isSubmitted}
      value={typeof answer === "string" ? answer : ""}
      onChange={(e) => handleBlockAnswerChange(block.id, e.target.value)}
      className={`w-full min-h-[140px] font-mono text-sm border rounded-lg p-3 focus:outline-none ${
        isSubmitted
          ? isCorrect
            ? "border-green-500 bg-green-50"
            : "border-red-500 bg-red-50"
          : "border-gray-300 focus:border-[var(--greek-blue)]"
      }`}
      placeholder="Écris ton algorithme / code ici..."
      spellCheck={false}
    />
    {exercise.grading_type === "ai" && !isSubmitted && (
      <div
        className="absolute right-3 bottom-3 text-[var(--greek-blue)]/50 pointer-events-none"
        title="Correction par IA"
      >
        <Sparkles className="w-5 h-5" />
      </div>
    )}
  </div>
  );
}
