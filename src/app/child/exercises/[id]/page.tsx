import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { stripAnswers, fillEmptyContentJson } from "@/lib/exerciseContent";
import ExerciseDetailClient from "@/components/child/ExerciseDetailClient";

export default async function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: exerciseId } = await params;

  // Le mode preview (ouvert depuis l'admin) charge son contenu depuis le
  // localStorage du navigateur : rien à prérécupérer côté serveur.
  if (exerciseId === "preview") {
    return (
      <ExerciseDetailClient
        exerciseId={exerciseId}
        initialExercise={null}
        initialAttemptsHistory={[]}
        initialAlreadyCompleted={false}
      />
    );
  }

  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");

  const [{ data: exerciseData, error }, { data: attemptRow }] = await Promise.all([
    supabaseAdmin
      .from("exercises")
      .select(`
        id, title, description, question,
        difficulty_level, type, level, status,
        folder_id, course_id, content_json,
        points_reward, max_attempts, time_limit,
        courses (title, subject, level),
        exercise_folders (name, color)
      `)
      .eq("id", exerciseId)
      .maybeSingle(),
    supabaseAdmin
      .from("user_exercise_attempts")
      .select("status, attempts_history")
      .eq("user_id", authUser.id)
      .eq("exercise_id", exerciseId)
      .maybeSingle(),
  ]);

  const exercise = error || !exerciseData ? null : stripAnswers(fillEmptyContentJson(exerciseData));

  let attemptsHistory: any[] = [];
  let alreadyCompleted = false;
  if (exercise) {
    attemptsHistory = attemptRow?.attempts_history || [];
    alreadyCompleted = attemptRow?.status === "completed";
  }

  return (
    <ExerciseDetailClient
      exerciseId={exerciseId}
      initialExercise={exercise}
      initialAttemptsHistory={attemptsHistory}
      initialAlreadyCompleted={alreadyCompleted}
    />
  );
}
