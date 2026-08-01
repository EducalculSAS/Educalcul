import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { stripAnswers } from "@/lib/quizContent";
import QuizReviewClient from "@/components/child/QuizReviewClient";

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
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-[var(--greek-blue)] mb-2">
          Aucune correction disponible
        </h1>
        <Link href="/child/quiz/history" className="text-[var(--greek-gold)] hover:underline">
          Retour à mes tentatives
        </Link>
      </div>
    );
  }

  return <QuizReviewClient quiz={quiz} progress={progress} />;
}
