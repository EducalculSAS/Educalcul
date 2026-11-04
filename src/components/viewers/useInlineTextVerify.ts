import { useState } from "react";
import type { Block } from "@/components/admin/ExerciseBuilder";
import type { ExerciseViewerProps } from "@/components/viewers/ExerciseViewer";
import type { InlineTextState } from "@/components/viewers/blocks/inlineText";
import type { AnswerMap } from "@/types/answers";
import { fetchMiniComment } from "@/lib/miniComment";

/** Correction immédiate des blocs « réponse libre » : vérification, nouvel essai, puis réponse proposée après 2 échecs. */
export function useInlineTextVerify(exercise: ExerciseViewerProps["exercise"], answers: AnswerMap) {
  // Correction immédiate des blocs "text_input" (même style que les
  // mini-exercices de cours) : vérifier tout de suite, réessayer, et
  // proposer la réponse après 2 échecs plutôt que de laisser retenter à
  // l'infini. Une fois résolu (correct ou révélé), la validation finale de
  // la page réutilise ce verdict au lieu de rappeler l'IA.
  const [inlineText, setInlineText] = useState<Record<string, InlineTextState>>({});

  const verifyTextBlock = async (block: Block) => {
    const studentAnswer = answers[block.id];
    if (!studentAnswer) return;
    const current = inlineText[block.id];
    const attemptsSoFar = current?.attempts || 0;
    setInlineText((prev) => ({ ...prev, [block.id]: { attempts: attemptsSoFar, status: "grading" } }));
    try {
      const exerciseId = exercise.id || "preview";
      // Démo publique (page Offres) : correction de démonstration, sans compte.
      const res = exerciseId === "demo"
        ? await fetch("/api/demo/grade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: "exercise", items: [{ block_id: block.id, answer: studentAnswer }] }),
          }).then(async (r) => new Response(JSON.stringify((await r.json())?.results?.[0] ?? { is_correct: false, feedback: "Correction indisponible, réessaie." }), { status: r.status }))
        : await fetch(`/api/child/exercises/${exerciseId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block_id: block.id,
          block,
          grading_type: exercise.grading_type,
          answer: studentAnswer,
          question: block.content,
          correctAnswer: block.correctAnswer,
          explanation: block.explanation,
          level: exercise.level || "6eme",
          points: block.points,
        }),
      });
      const data = await res.json();
      if (data.unavailable) {
        setInlineText((prev) => ({
          ...prev,
          [block.id]: { attempts: attemptsSoFar, status: "unavailable", feedback: data.feedback },
        }));
        return;
      }
      if (data.is_correct) {
        setInlineText((prev) => ({
          ...prev,
          [block.id]: {
            attempts: attemptsSoFar + 1,
            status: "correct",
            feedback: data.feedback,
            resolvedScore: data.score,
            resolvedCorrect: true,
          },
        }));
      } else {
        const attempts = attemptsSoFar + 1;
        if (attempts >= 2) {
          // 2 échecs d'affilée : on propose directement la réponse plutôt
          // que de laisser l'élève retenter indéfiniment. La bonne réponse
          // vient de data.reveal (le client n'a jamais correctAnswer avant
          // d'avoir soumis — voir le commentaire dans la route de grading).
          setInlineText((prev) => ({
            ...prev,
            [block.id]: {
              attempts,
              status: "revealed",
              feedback: data.feedback,
              resolvedScore: 0,
              resolvedCorrect: false,
              revealedAnswer:
                typeof data.reveal?.correctAnswer === "string" ? data.reveal.correctAnswer : undefined,
            },
          }));
        } else {
          setInlineText((prev) => ({
            ...prev,
            [block.id]: { attempts, status: "wrong", feedback: data.feedback },
          }));
        }
        // Verdict et réponse de base déjà affichés : le mini commentaire de l'IA arrive juste après, quand il y en a un.
        void fetchMiniComment(data.comment_token).then((comment) => {
          if (!comment) return;
          setInlineText((prev) => {
            const cur = prev[block.id];
            return cur && cur.attempts === attempts && (cur.status === "wrong" || cur.status === "revealed") ? { ...prev, [block.id]: { ...cur, feedback: comment } } : prev;
          });
        });
      }
    } catch {
      setInlineText((prev) => ({
        ...prev,
        [block.id]: { attempts: attemptsSoFar, status: "unavailable", feedback: "Correction indisponible, réessaie." },
      }));
    }
  };

  return { inlineText, verifyTextBlock };
}
