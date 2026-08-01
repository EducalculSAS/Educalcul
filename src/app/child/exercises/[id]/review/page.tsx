import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { stripAnswers, fillEmptyContentJson } from "@/lib/exerciseContent";
import ExerciseReviewClient from "@/components/child/ExerciseReviewClient";

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
        points_reward, max_attempts, time_limit,
        created_at, updated_at,
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

  const exercise = error || !exerciseData ? null : stripAnswers(fillEmptyContentJson(exerciseData));
  const progress = attemptRow?.progress_json || null;

  if (!exercise || !progress) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-[var(--greek-blue)] mb-2">
          Aucune correction disponible
        </h1>
        <Link href="/child/exercises/history" className="text-[var(--greek-gold)] hover:underline">
          Retour à mes tentatives
        </Link>
      </div>
    );
  }

  return <ExerciseReviewClient exercise={exercise} progress={progress} />;
}
