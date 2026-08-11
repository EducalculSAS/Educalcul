import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { stripAnswers } from "@/lib/quizContent";
import QuizDetailClient from "@/components/child/QuizDetailClient";

export default async function QuizDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pid?: string }>;
}) {
  const { id: quizId } = await params;

  // Le mode preview (ouvert depuis l'admin, contenu pas encore enregistré) —
  // transmis via une ligne content_previews temporaire, jamais via
  // localStorage. Réservé aux admins connectés.
  if (quizId === "preview") {
    const { pid } = await searchParams;
    const admin = await getServerUser();
    if (!admin || admin.role !== "admin") redirect("/auth/connexion");
    if (!pid) {
      return (
        <QuizDetailClient
          quizId={quizId}
          initialQuiz={null}
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
      .eq("type", "quiz")
      .maybeSingle();

    return (
      <QuizDetailClient
        quizId={quizId}
        initialQuiz={(preview?.payload as any) || null}
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
