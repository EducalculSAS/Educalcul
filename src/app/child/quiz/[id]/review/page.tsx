import Emblem3D from "@/components/Emblem3D";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { stripAnswers } from "@/lib/quizContent";
import QuizReviewClient from "@/components/child/QuizReviewClient";
import GlassButton from "@/components/ui/GlassButton";

export default async function QuizReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: quizId } = await params;
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");

  const [{ data: quizData, error }, { data: attemptRow }] = await Promise.all([
    supabaseAdmin
      .from("quizzes")
      .select(`*, courses (title), quiz_folders (name, color)`)
      .eq("id", quizId)
      .maybeSingle(),
    supabaseAdmin
      .from("user_quiz_attempts")
      .select("progress_json")
      .eq("user_id", authUser.id)
      .eq("quiz_id", quizId)
      .maybeSingle(),
  ]);

  const quiz = error || !quizData ? null : stripAnswers(quizData);
  const progress = attemptRow?.progress_json || null;

  if (!quiz || !progress) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <Emblem3D kind="alert" size={88} className="mb-4" />
        <h1 className="text-2xl font-bold text-[var(--greek-blue)] mb-2">
          Aucune correction disponible
        </h1>
        <GlassButton href="/child/quiz/history" variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4" /> Retour à mes tentatives
        </GlassButton>
      </div>
    );
  }

  return <QuizReviewClient quiz={quiz} progress={progress} />;
}
