import type { Loose } from "@/types/loose";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { stripAnswers, fillEmptyContentJson } from "@/lib/exerciseContent";
import { checkDifficultyAccess } from "@/lib/checkSubscription";
import { childMayOpen } from "@/lib/levelAccess";
import ExerciseDetailClient from "@/components/child/ExerciseDetailClient";

export default async function ExerciseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pid?: string }>;
}) {
  const { id: exerciseId } = await params;

  // Le mode preview (ouvert depuis l'admin, contenu pas encore enregistré) —
  // transmis via une ligne content_previews temporaire, jamais via
  // localStorage. Réservé aux admins connectés.
  if (exerciseId === "preview") {
    const { pid } = await searchParams;
    const admin = await getServerUser();
    if (!admin || admin.role !== "admin") redirect("/auth/connexion");
    if (!pid) {
      return (
        <ExerciseDetailClient
          exerciseId={exerciseId}
          initialExercise={null}
          initialAttemptsHistory={[]}
          initialAlreadyCompleted={false}
        />
      );
    }

    const { data: preview } = await supabaseAdmin
      .from("content_previews")
      .select("payload")
      .eq("id", pid)
      .eq("admin_id", admin.id)
      .eq("type", "exercise")
      .maybeSingle();

    return (
      <ExerciseDetailClient
        exerciseId={exerciseId}
        initialExercise={(preview?.payload as unknown) || null}
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
        points_reward, max_attempts, time_limit, time_limit_minutes, min_score_percent,
        estimated_time, grading_type,
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

  // Verrou de difficulté par plan — appliqué ici (pas seulement dans le
  // catalogue, contournable par URL directe) : voir contexte du plan sur
  // access_level_exercises. authId, pas authUser.id (checkDifficultyAccess
  // résout lui-même l'enfant -> abonnement du parent).
  // Un brouillon n'existe pas pour un élève : le catalogue ne le montre pas, et l'adresse directe non plus.
  if (exercise && authUser.role !== "admin" && exercise.status !== "published") redirect("/child/exercises");
  // Un élève n'ouvre par adresse directe que le contenu de ses niveaux (comme le catalogue).
  if (exercise && !(await childMayOpen(authUser, { kind: "exercise", id: exerciseId, level: exercise.level, folder_id: exercise.folder_id }, "exercise_folders"))) redirect("/child/exercises");
  if (exercise) {
    const { allowed } = await checkDifficultyAccess(authUser.authId, exercise.difficulty_level);
    if (!allowed) redirect("/child/exercises");
  }

  let attemptsHistory: Loose[] = [];
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
