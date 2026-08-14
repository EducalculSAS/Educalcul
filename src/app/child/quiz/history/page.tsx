import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import Link from "next/link";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import GlassButton from "@/components/ui/GlassButton";

export default async function QuizHistoryPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");

  const { data: attempts } = await supabaseAdmin
    .from("user_quiz_attempts")
    .select("*, quizzes(title)")
    .eq("user_id", authUser.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <GlassButton href="/child/quiz" variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4" /> Retour aux quiz
        </GlassButton>
      </div>

      <h1 className="text-2xl md:text-3xl font-bold text-[var(--greek-blue)] mb-6 font-[family-name:var(--font-display)]">
        Mes tentatives
      </h1>

      {!attempts || attempts.length === 0 ? (
        <div className="text-center text-[var(--text-muted)] py-12">
          Tu n'as pas encore terminé de quiz.
        </div>
      ) : (
        <div className="space-y-3">
          {attempts.map((a) => {
            const passed = a.passed ?? (a.score_percent != null ? a.score_percent >= 50 : true);
            return (
              <Link
                key={a.id}
                href={`/child/quiz/${a.quiz_id}/review`}
                className="card-academic flex items-center justify-between gap-4 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {passed ? (
                    <CheckCircle className="w-6 h-6 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-[var(--text-dark)] truncate">
                      {a.quizzes?.title || "Quiz"}
                    </div>
                    <div className="text-sm text-[var(--text-muted)] flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      {a.completed_at
                        ? new Date(a.completed_at).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "—"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold text-[var(--greek-blue)]">
                    {a.score} / {a.total_points}
                  </span>
                  <Eye className="w-5 h-5 text-[var(--greek-gold)]" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
