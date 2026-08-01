import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { stripAnswers } from "@/lib/quizContent";
import QuizDetailClient from "@/components/child/QuizDetailClient";

export default async function QuizDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: quizId } = await params;

  // Le mode preview (ouvert depuis l'admin) charge son contenu depuis le
  // localStorage du navigateur : rien à prérécupérer côté serveur.
  if (quizId === "preview") {
    return (
      <QuizDetailClient
        quizId={quizId}
        initialQuiz={null}
        initialAttemptsHistory={[]}
        initialAlreadyCompleted={false}
      />
    );
  }

  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");

  const { data: quizData, error } = await supabaseAdmin
    .from("quizzes")
    .select(`*, courses (title), quiz_folders (name, color)`)
    .eq("id", quizId)
    .maybeSingle();

  const quiz = error || !quizData ? null : stripAnswers(quizData);

  let attemptsHistory: any[] = [];
  let alreadyCompleted = false;
  if (quiz) {
    const { data: attemptRow } = await supabaseAdmin
      .from("user_quiz_attempts")
      .select("status, attempts_history")
      .eq("user_id", authUser.id)
      .eq("quiz_id", quizId)
      .maybeSingle();
    attemptsHistory = attemptRow?.attempts_history || [];
    alreadyCompleted = attemptRow?.status === "completed";
  }

  return (
    <QuizDetailClient
      quizId={quizId}
      initialQuiz={quiz}
      initialAttemptsHistory={attemptsHistory}
      initialAlreadyCompleted={alreadyCompleted}
    />
  );
}
