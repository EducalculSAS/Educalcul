import { one } from "@/lib/relations";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { stripAnswers, fillEmptyContentJson } from "@/lib/exerciseContent";
import ExerciseReviewClient from "@/components/child/ExerciseReviewClient";
import GlassButton from "@/components/ui/GlassButton";

export default async function ExerciseReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: exerciseId } = await params;
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
      .select("progress_json")
      .eq("user_id", authUser.id)
      .eq("exercise_id", exerciseId)
      .maybeSingle(),
  ]);

  const prepared = error || !exerciseData ? null : stripAnswers(fillEmptyContentJson(exerciseData));
  // Relations « vers un » : objet à l'exécution, annoncées en tableau par le typage de la requête.
  const exercise = prepared && { ...prepared, courses: one(prepared.courses), exercise_folders: one(prepared.exercise_folders) };
  const progress = attemptRow?.progress_json || null;

  if (!exercise || !progress) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-[var(--greek-blue)] mb-2">
          Aucune correction disponible
        </h1>
        <GlassButton href="/child/exercises/history" variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4" /> Retour à mes tentatives
        </GlassButton>
      </div>
    );
  }

  return <ExerciseReviewClient exercise={exercise} progress={progress} />;
}
