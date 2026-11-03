"use client";
 
import type { AnswerMap, AnswerValue } from "@/types/answers";
import { type Block } from "@/components/admin/ExerciseBuilder";
import { AdminAttemptControls } from "@/components/viewers/blocks/AdminAttemptControls";

type AdminReviewPanelProps = {
  block: Block;
  answer: AnswerValue;
  adminComments: Record<string, string>;
  adminEditedAnswers: AnswerMap;
  adminMode: { onComment: (blockId: string, text: string) => void; onEditAnswer: (blockId: string, value: AnswerValue) => void; 
/** Correction manuelle : compter la réponse juste ou fausse (exercices). */
onVerdict?: (blockId: string, correct: boolean) => void; saving?: boolean; };
};

export default function AdminReviewPanel(props: AdminReviewPanelProps) {
  const { block, answer, adminComments, adminEditedAnswers, adminMode } = props;
  return (
    <AdminAttemptControls
    itemKey={block.id}
    currentAnswer={answer}
    existingComment={adminComments[block.id]}
    existingEditedAnswer={adminEditedAnswers[block.id]}
    adminMode={adminMode}
  />
  );
}
