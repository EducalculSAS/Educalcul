// Extrait de src/app/api/admin/quizzes/route.ts pour être réutilisé tel quel
// côté serveur (page /child/quiz/[id]) sans dupliquer une logique sensible :
// elle retire les champs qui révèlent la bonne réponse avant qu'un contenu
// n'atteigne un élève. Toute modification doit rester cohérente entre les
// deux usages.
import type { Question } from "@/components/admin/QuizBuilder";

export function stripAnswers<T extends { content_json?: unknown }>(quiz: T): T {
  if (!quiz?.content_json || !Array.isArray(quiz.content_json)) return quiz;
  return {
    ...quiz,
    content_json: (quiz.content_json as Question[]).map((q) => {
      const { correctAnswer, explanation, ...safe } = q;
      return safe;
    }),
  } as T;
}
