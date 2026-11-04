import type { Page } from "@/components/admin/ExerciseBuilder";
import type { ExerciseViewerProps, RevealInfo } from "@/components/viewers/ExerciseViewer";
import type { InlineTextState } from "@/components/viewers/blocks/inlineText";
import type { AnswerMap } from "@/types/answers";

/** Correction d'un bloc renvoyée par /api/child/exercises/[id]/grade (ou par la route d'aperçu admin). */
export interface ExerciseGradeResult {
  block_id?: string;
  unavailable?: boolean;
  is_correct?: boolean;
  feedback?: string;
  comment_token?: string;
  reveal?: RevealInfo;
  score?: number;
}

interface GradeInput {
  exercise: ExerciseViewerProps["exercise"];
  pages: Page[];
  answers: AnswerMap;
  inlineText: Record<string, InlineTextState>;
}
type GradeOutcome =
  | { error: string }
  | {
      newResults: Record<string, boolean>;
      newAiFeedback: Record<string, string>;
      newCommentTokens: Record<string, string>;
      newRevealed: Record<string, RevealInfo>;
      newSubmitted: Set<string>;
      totalScore: number;
    };

/** Correction de toute la copie : réponses déjà vérifiées en direct réutilisées, le reste envoyé au serveur en UNE requête. */
export async function gradeAnswers({ exercise, pages, answers, inlineText }: GradeInput): Promise<GradeOutcome> {
  let totalScore = 0;
  const newResults: Record<string, boolean> = {};
  const newAiFeedback: Record<string, string> = {};
  const newCommentTokens: Record<string, string> = {};
  const newRevealed: Record<string, RevealInfo> = {};
  const newSubmitted = new Set<string>();
  const exerciseId = exercise.id || "preview";

  // Toute la copie part en UNE requête (corrigée en parallèle côté
  // serveur) — avant, chaque question attendait la précédente.
  const toGrade: { block: (typeof pages)[number]["blocks"][number]; answer: unknown }[] = [];
  for (const page of pages) {
    for (const block of page.blocks) {
      if (["text", "image"].includes(block.type)) continue;
      const answer = answers[block.id];
      const points = block.points || 0;

      if (answer === undefined || answer === null) {
        newResults[block.id] = false;
        newSubmitted.add(block.id);
        continue;
      }

      // Déjà vérifié en direct via le bouton "Vérifier" du bloc
      // (text_input) : on réutilise ce verdict plutôt que de rappeler
      // l'IA une seconde fois pour la même réponse.
      const inlineResult = inlineText[block.id];
      if (block.type === "text_input" && inlineResult?.resolvedCorrect !== undefined) {
        newResults[block.id] = inlineResult.resolvedCorrect;
        newAiFeedback[block.id] = inlineResult.feedback || "";
        if (inlineResult.revealedAnswer) {
          newRevealed[block.id] = { correctAnswer: inlineResult.revealedAnswer };
        }
        newSubmitted.add(block.id);
        if (inlineResult.resolvedCorrect) totalScore += inlineResult.resolvedScore ?? points;
        continue;
      }
      toGrade.push({ block, answer });
    }
  }

  // Correction manuelle : aucune note automatique, les réponses sont simplement enregistrées (l'enseignant les corrige ensuite).
  if (exercise.grading_type === "manual") {
    toGrade.splice(0).forEach(({ block }) => {
      newResults[block.id] = false;
      newSubmitted.add(block.id);
    });
  }

  if (toGrade.length > 0) {
    // La correction se fait toujours côté serveur (à partir des données
    // enregistrées en base) : le client ne connaît jamais la réponse
    // correcte avant d'avoir soumis la sienne.
    try {
      const preview = exerciseId === "preview";
      const results = await Promise.all(
        preview
          // Aperçu admin : l'énoncé part avec chaque question (pas en base).
          ? toGrade.map(({ block, answer }) =>
              fetch(`/api/child/exercises/preview/grade`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ block_id: block.id, block, grading_type: exercise.grading_type, answer, question: block.content, correctAnswer: block.correctAnswer, explanation: block.explanation, level: exercise.level || "6eme", points: block.points }),
              }).then((r) => r.json()).then((d) => ({ ...d, block_id: block.id })),
            )
          : [
              fetch(`/api/child/exercises/${exerciseId}/grade`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: toGrade.map(({ block, answer }) => ({ block_id: block.id, answer })) }),
              }).then(async (r) => {
                const d = await r.json();
                if (!r.ok) throw new Error(d.error || "Correction indisponible, réessaie.");
                return d.results as ExerciseGradeResult[];
              }),
            ],
      ).then((out) => (preview ? out : out[0]) as ExerciseGradeResult[]);

      const byBlock = new Map(results.map((r) => [r.block_id, r]));
      if (results.some((r) => r?.unavailable)) {
        // Panne d'infra, pas une vraie tentative : rien n'est enregistré,
        // l'élève peut resoumettre à l'identique.
        return { error: results.find((r) => r?.unavailable)?.feedback || "Correction indisponible, réessaie." };
      }
      for (const { block } of toGrade) {
        const data: ExerciseGradeResult = byBlock.get(block.id) || {};
        const isCorrect = !!data.is_correct;
        if (data.feedback) newAiFeedback[block.id] = data.feedback;
        if (data.comment_token) newCommentTokens[block.id] = data.comment_token;
        if (data.reveal) newRevealed[block.id] = data.reveal;
        newResults[block.id] = isCorrect;
        newSubmitted.add(block.id);
        // Crédit partiel : une association bien placée sur trois rapporte son point même si le bloc n'est pas parfait.
        if (data.score !== undefined) totalScore += data.score;
        else if (isCorrect) totalScore += block.points || 0;
      }
    } catch (e) {
      console.error(e);
      return { error: (e as Error).message || "Correction indisponible, réessaie." };
    }
  }
  return { newResults, newAiFeedback, newCommentTokens, newRevealed, newSubmitted, totalScore };
}
