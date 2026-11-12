import Emblem3D from "@/components/Emblem3D";
import { parseOrNull } from "@/lib/validate";
import { exerciseItemSchema, quizItemSchema } from "@/lib/schemas";

import { supabaseAdmin } from "@/lib/supabaseClient";
import { fillEmptyContentJson } from "@/lib/exerciseContent";
import AdminAttemptReviewClient from "@/components/admin/AdminAttemptReviewClient";
import GlassButton from "@/components/ui/GlassButton";

type Kind = "exercise" | "quiz";

const TABLE: Record<Kind, string> = {
  exercise: "user_exercise_attempts",
  quiz: "user_quiz_attempts",
};
const ITEM_COLUMN: Record<Kind, string> = {
  exercise: "exercise_id",
  quiz: "quiz_id",
};
const CONTENT_TABLE: Record<Kind, string> = {
  exercise: "exercises",
  quiz: "quizzes",
};

/** Revue admin d'une copie d'élève (exercice ou quiz), avec commentaire par
 * question + édition de la réponse enregistrée — même écran que la
 * correction vue par l'élève (ExerciseViewer/QuizViewer en reviewMode), en
 * plus des contrôles admin. Route par query params, cohérent avec
 * /admin/users/detail?id= (pas de segment dynamique dans ce dossier admin). */
export default async function AttemptReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; kind?: string; itemId?: string }>;
}) {
  const { userId, kind: rawKind, itemId } = await searchParams;
  const kind = rawKind === "exercise" || rawKind === "quiz" ? (rawKind as Kind) : null;

  if (!userId || !kind || !itemId) {
    return (
      <div className="p-6 flex flex-col items-center text-center gap-4">
        <Emblem3D kind="alert" size={64} />
        <p className="text-gray-600">Paramètres manquants.</p>
      </div>
    );
  }

  const [{ data: child }, { data: item, error: itemError }, { data: attempt }] = await Promise.all([
    supabaseAdmin.from("users").select("id, first_name, last_name").eq("id", userId).maybeSingle(),
    supabaseAdmin.from(CONTENT_TABLE[kind]).select("id, title, content_json, min_score_percent").eq("id", itemId).maybeSingle(),
    supabaseAdmin
      .from(TABLE[kind])
      .select("id, progress_json, attempts_history, score, total_points")
      .eq("user_id", userId)
      .eq(ITEM_COLUMN[kind], itemId)
      .maybeSingle(),
  ]);

  if (itemError || !item || !attempt) {
    return (
      <div className="p-6 flex flex-col items-center text-center gap-4">
        <Emblem3D kind="alert" size={64} />
        <p className="text-gray-600">Aucune tentative trouvée pour cet élève sur ce contenu.</p>
        <GlassButton href={`/admin/users/detail?id=${userId}`} variant="ghost" size="sm">Retour à la fiche</GlassButton>
      </div>
    );
  }

  const shared = {
    userId: String(userId),
    childName: child ? `${child.first_name} ${child.last_name}` : "Élève",
    itemId: String(itemId),
    attempt,
  };
  const exerciseItem = kind === "exercise" ? parseOrNull(exerciseItemSchema, fillEmptyContentJson(item), "exercice (revue)") : null;
  const quizItem = kind === "quiz" ? parseOrNull(quizItemSchema, item, "quiz (revue)") : null;
  if (exerciseItem) return <AdminAttemptReviewClient {...shared} kind="exercise" item={exerciseItem} />;
  if (quizItem) return <AdminAttemptReviewClient {...shared} kind="quiz" item={quizItem} />;
  return (
    <div className="p-6 text-center text-gray-600">Contenu illisible : impossible d&apos;afficher cette copie.</div>
  );
}
