"use client";
 
import { answerText, type AnswerMap, type AnswerValue } from "@/types/answers";
import LoaderDots from "@/components/LoaderDots";
import type { InlineTextState } from "@/components/viewers/blocks/inlineText";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import { Keyboard, Pencil, Sparkles } from "lucide-react";
import DrawingCanvas from "@/components/DrawingCanvas";
import MathInput, { type MathInputHandle } from "@/components/MathInput";
import GlassButton from "@/components/ui/GlassButton";
import AnswerFeedback from "@/components/viewers/AnswerFeedback";
import { type Page, type Block } from "@/components/admin/ExerciseBuilder";

type TextInputAnswerProps = {
  blockModes: Record<string, 'text' | 'draw'>;
  block: Block;
  setBlockModes: React.Dispatch<React.SetStateAction<Record<string, 'text' | 'draw'>>>;
  isSubmitted: boolean;
  inlineResolved: boolean;
  answer: AnswerValue;
  handleBlockAnswerChange: (blockId: string, value: AnswerValue) => void;
  answers: AnswerMap;
  mathfieldRefs: React.RefObject<Record<string, MathInputHandle | null>>;
  isCorrect: boolean;
  inline: InlineTextState;
  exercise: { id?: string; title: string; description?: string | null; content_json: Page[] | null; grading_type?: 'auto' | 'ai' | 'manual'; level?: string; type?: string; difficulty_level?: string; course_id?: string | number | null; courses?: { title?: string; subject?: string; level?: string; } | null; min_score_percent?: number | null; max_attempts?: number | null; time_limit_minutes?: number | null; };
  verifyTextBlock: (block: Block) => Promise<void>;
};

export default function TextInputAnswer(props: TextInputAnswerProps) {
  const { blockModes, block, setBlockModes, isSubmitted, inlineResolved, answer, handleBlockAnswerChange, answers, mathfieldRefs, isCorrect, inline, exercise, verifyTextBlock } = props;
  return (
    <div className="flex flex-col gap-2" data-exercise-answer-block>
    {/* Mode Toggle */}
    <div className="flex justify-end mb-1">
      <GlassSegmentedControl
        size="sm"
        options={[
          {
            id: "text",
            label: (
              <span className="flex items-center gap-1">
                <Keyboard className="w-3 h-3" /> Clavier
              </span>
            ),
          },
          {
            id: "draw",
            label: (
              <span className="flex items-center gap-1">
                <Pencil className="w-3 h-3" /> Dessin
              </span>
            ),
          },
        ]}
        value={blockModes[block.id] || "text"}
        onChange={(mode) =>
          setBlockModes((prev) => ({
            ...prev,
            [block.id]: mode as "text" | "draw",
          }))
        }
      />
    </div>
  
    {blockModes[block.id] === "draw" ? (
      <DrawingCanvas
        disabled={isSubmitted || inlineResolved}
        initialData={typeof answer === "string" ? answer : undefined}
        onChange={(data) =>
          handleBlockAnswerChange(block.id, data)
        }
      />
    ) : (
      <>
        {(() => {
          const stored = answerText(answers[block.id]);
          const currentVal = stored && !stored.startsWith("data:image") ? stored : "";
          return (
            <div className="relative">
              <MathInput
                ref={(el) => {
                  mathfieldRefs.current[block.id] = el;
                }}
                value={currentVal}
                disabled={isSubmitted || inlineResolved}
                onChange={(latex) =>
                  handleBlockAnswerChange(block.id, latex)
                }
                className={`w-full min-h-[60px] border rounded-xl focus-within:ring-2 focus-within:ring-[var(--greek-blue)] text-lg ${
                  isSubmitted
                    ? isCorrect
                      ? "border-green-500 bg-green-50"
                      : "border-red-500 bg-red-50"
                    : inline?.status === "correct"
                    ? "border-green-500 bg-green-50"
                    : inline?.status === "wrong" || inline?.status === "revealed"
                    ? "border-red-500 bg-red-50"
                    : "border-gray-300 focus-within:border-[var(--greek-blue)]"
                }`}
                placeholder="Tapez votre réponse"
                ariaLabel={block.title || "Réponse mathématique"}
                level={exercise.level}
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
        })()}
      </>
    )}
  
    {/* Correction immédiate, même style que les mini-exercices de cours */}
    {!isSubmitted && (
      <>
        {!inlineResolved && (
          <GlassButton
            onClick={() => verifyTextBlock(block)}
            disabled={!answer || inline?.status === "grading"}
            variant="navy"
            size="sm"
            className="self-start min-w-[150px]"
          >
            {inline?.status === "grading" ? (
              <>
                <LoaderDots />
                <span>Correction...</span>
              </>
            ) : (
              "Vérifier"
            )}
          </GlassButton>
        )}
  
        {inline && ["correct", "wrong", "revealed", "unavailable"].includes(inline.status) && (
          <AnswerFeedback
            kind={inline.status as "correct" | "wrong" | "revealed" | "unavailable"}
            feedback={inline.feedback}
            correctAnswer={inline.status === "revealed" ? inline.revealedAnswer : undefined}
            tryAgain={inline.status === "wrong"}
          />
        )}
      </>
    )}
  </div>
  );
}
