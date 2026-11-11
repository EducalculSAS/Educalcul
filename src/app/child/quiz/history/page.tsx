import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle, XCircle, Clock, Eye, Trophy } from "lucide-react";
import PageHero from "@/components/PageHero";
import Link from "@/components/AppLink";
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
    .order("completed_at", { ascending: false })
    .limit(200);

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-16">
      <PageHero
        icon={Trophy}
        title="Mes tentatives"
        badge="Historique"
        subtitle="Tes 200 dernières tentatives, avec leur correction."
        width="4xl"
        top={
          <GlassButton href="/child/quiz" variant="light" size="sm">
            <ArrowLeft className="w-4 h-4" /> Retour aux quiz
          </GlassButton>
        }
      />
      <div className="container mx-auto px-4 max-w-3xl">

      {!attempts || attempts.length === 0 ? (
        <div className="text-center text-[var(--text-muted)] py-12">
          Tu n&apos;as pas encore terminé de quiz.
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
                        ? new Date(a.completed_at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "-"}
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
    </div>
  );
}
