"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Award,
  BookOpen,
  CheckCircle,
  XCircle,
  Calendar,
  BarChart2,
  TrendingUp,
  Activity,
} from "lucide-react";
import MathLoader from "@/components/MathLoader";
import { useParams } from "next/navigation";

// Interfaces
interface QuizData {
  title: string;
}

interface ExerciseData {
  title: string;
}

interface CourseData {
  title: string;
}

interface QuizAttempt {
  id: string;
  completed_at: string;
  score: number;
  total_questions: number;
  quizzes: QuizData | null;
}

interface ExerciseAttempt {
  id: string;
  attempted_at: string;
  is_correct: boolean;
  exercises: ExerciseData | null;
}

interface SessionData {
  id: string;
  session_ended_at: string;
  duration_seconds: number;
  user_course_views: {
    courses: CourseData | null;
  } | null;
}

interface ChildProfile {
  id: string;
  first_name: string;
  last_name: string;
  grade_level: string | null;
  username: string | null;
  avatar?: string;
}

interface ActivityItem {
  id: string;
  type: "Quiz" | "Exercice" | "Cours";
  title: string;
  date: string;
  score?: string;
  status?: "success" | "failure" | "completed";
  duration?: string;
}

export default function ChildReportPage() {
  const params = useParams();
  const router = useRouter();
  const childId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState({
    totalTime: { hours: 0, minutes: 0 },
    avgScore: 0,
    totalActivities: 0,
    completedCourses: 0,
    quizzesTaken: 0,
    exercisesDone: 0,
  });

  useEffect(() => {
    const fetchChildData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth/connexion");
          return;
        }

        // 1. Verify Parent and Child Ownership
        const { data: parentRecord } = await supabase
          .from("users")
          .select("id")
          .eq("auth_id", user.id)
          .eq("role", "parent")
          .maybeSingle();

        if (!parentRecord) {
          router.push("/dashboard"); // Not a parent
          return;
        }

        console.log("Fetching child with ID:", childId);

        // Relaxed query: rely on RLS (Row Level Security) or manual check
        const { data: childData, error: childError } = await supabase
          .from("users")
          .select(
            "id, first_name, last_name, grade_level, username, avatar, parent_id"
          )
          .eq("id", childId)
          .maybeSingle();

        if (childError || !childData) {
          console.error(
            "Child not found or not authorized (query failed)",
            childError
          );
          // router.push("/parent/dashboard");
          return;
        }

        // Manual verification just in case RLS didn't catch it (though it should)
        if (childData.parent_id !== parentRecord.id) {
          console.error(
            "Child found but belongs to another parent (manual check failed)"
          );
          // router.push("/parent/dashboard");
          return;
        }

        setChild(childData);

        // 2. Fetch Activities
        // Fetch recent sessions
        const { data: sessions } = (await supabase
          .from("user_course_sessions")
          .select(
            `
            id, 
            session_ended_at, 
            duration_seconds,
            user_course_views!inner (
              user_id,
              courses (title)
            )
          `
          )
          .eq("user_course_views.user_id", childId)
          .order("session_ended_at", { ascending: false })
          .limit(20)) as any; // Cast to avoid deep type matching issues for now

        // Fetch recent quizzes
        const { data: quizzes } = await supabase
          .from("user_quiz_attempts")
          .select("id, completed_at, score, total_questions, quizzes(title)")
          .eq("user_id", childId)
          .order("completed_at", { ascending: false })
          .limit(20);

        // Fetch recent exercises
        const { data: exercises } = await supabase
          .from("user_exercise_attempts")
          .select("id, attempted_at, is_correct, exercises(title)")
          .eq("user_id", childId)
          .order("attempted_at", { ascending: false })
          .limit(20);

        // Process Data
        let allActivities: ActivityItem[] = [];
        let totalSeconds = 0;
        let totalScore = 0;
        let scoreCount = 0;

        // Process Sessions
        if (sessions) {
          sessions.forEach((session: any) => {
            totalSeconds += session.duration_seconds || 0;
            allActivities.push({
              id: session.id,
              type: "Cours",
              title:
                session.user_course_views?.courses?.title || "Cours sans titre",
              date: session.session_ended_at,
              duration: `${Math.floor(
                (session.duration_seconds || 0) / 60
              )} min`,
              status: "completed",
            });
          });
        }

        // Process Quizzes
        if (quizzes) {
          quizzes.forEach((quiz: any) => {
            const percentage =
              quiz.total_questions > 0
                ? (quiz.score / quiz.total_questions) * 100
                : 0;
            totalScore += percentage;
            scoreCount++;

            allActivities.push({
              id: quiz.id,
              type: "Quiz",
              title: quiz.quizzes?.title || "Quiz sans titre",
              date: quiz.completed_at,
              score: `${quiz.score}/${quiz.total_questions}`,
              status: percentage >= 50 ? "success" : "failure",
            });
          });
        }

        // Process Exercises
        if (exercises) {
          exercises.forEach((ex: any) => {
            allActivities.push({
              id: ex.id,
              type: "Exercice",
              title: ex.exercises?.title || "Exercice sans titre",
              date: ex.attempted_at,
              score: ex.is_correct ? "Correct" : "Incorrect",
              status: ex.is_correct ? "success" : "failure",
            });
          });
        }

        // Sort and Limit
        allActivities.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setActivities(allActivities);

        // Calculate Stats
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        setStats({
          totalTime: { hours, minutes },
          avgScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
          totalActivities: allActivities.length,
          completedCourses: sessions?.length || 0,
          quizzesTaken: quizzes?.length || 0,
          exercisesDone: exercises?.length || 0,
        });
      } catch (err) {
        console.error("Error fetching report data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchChildData();
  }, [childId, router]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <MathLoader />
      </div>
    );
  }

  if (!child) return null;

  return (
    <main className="container mx-auto px-4 py-8 min-h-screen">
      <Link
        href="/parent/dashboard"
        className="inline-flex items-center text-[var(--greek-blue)] hover:text-[var(--greek-gold)] mb-6 transition-colors font-medium"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Retour au tableau de bord
      </Link>

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 p-8 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--greek-blue)] rounded-full -mr-32 -mt-32 opacity-10 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-white shadow-md rounded-full flex items-center justify-center text-[var(--greek-blue)] font-bold text-3xl overflow-hidden border-4 border-[var(--greek-gold)]/20">
              {child.avatar ? (
                <img
                  src={`/avatars/${child.avatar}`}
                  alt={child.first_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                child.first_name.charAt(0)
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[var(--greek-blue)] mb-2 font-[family-name:var(--font-display)]">
                Rapport de {child.first_name} {child.last_name}
              </h1>
              <div className="flex items-center gap-4 text-slate-500">
                <span className="bg-[var(--greek-blue)]/10 text-[var(--greek-blue)] px-3 py-1 rounded-full text-sm font-medium border border-[var(--greek-blue)]/20">
                  {child.grade_level || "Niveau non défini"}
                </span>
                <span className="text-sm">@{child.username || "username"}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="flex items-center gap-2 bg-white/50 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg hover:bg-white transition-colors shadow-sm">
              <Calendar className="w-4 h-4" />
              <span>Cette semaine</span>
            </button>
            <button className="flex items-center gap-2 bg-[var(--greek-blue)] text-white px-4 py-2 rounded-lg hover:bg-[var(--greek-blue)] transition-colors shadow-md">
              <BarChart2 className="w-4 h-4" />
              <span>Exporter PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all hover:-translate-y-1">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">
                Temps Total
              </p>
              <h3 className="text-3xl font-bold text-[var(--greek-blue)] mt-1">
                {stats.totalTime.hours}h {stats.totalTime.minutes}m
              </h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg text-blue-500">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          <div className="text-xs text-slate-400">
            Sur les 20 dernières sessions
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md p-6 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all hover:-translate-y-1">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">
                Score Moyen
              </p>
              <h3 className="text-3xl font-bold text-[var(--greek-blue)] mt-1">
                {stats.avgScore}%
              </h3>
            </div>
            <div className="p-3 bg-green-50 rounded-lg text-green-500">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <div className="text-xs text-slate-400">
            Basé sur les quiz complétés
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md p-6 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all hover:-translate-y-1">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">
                Activités
              </p>
              <h3 className="text-3xl font-bold text-[var(--greek-blue)] mt-1">
                {stats.totalActivities}
              </h3>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg text-purple-500">
              <Activity className="w-6 h-6" />
            </div>
          </div>
          <div className="text-xs text-slate-400">
            Total exercices, quiz et cours
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md p-6 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all hover:-translate-y-1">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">
                Quiz & Exos
              </p>
              <h3 className="text-3xl font-bold text-[var(--greek-blue)] mt-1">
                {stats.quizzesTaken + stats.exercisesDone}
              </h3>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg text-orange-500">
              <Award className="w-6 h-6" />
            </div>
          </div>
          <div className="text-xs text-slate-400">
            {stats.quizzesTaken} Quiz, {stats.exercisesDone} Exos
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity List */}
        <div className="lg:col-span-2 bg-white/80 backdrop-blur-md rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 overflow-hidden">
          <div className="p-6 border-b border-[rgba(52,73,94,0.1)] flex justify-between items-center">
            <h3 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
              Historique d'Activité
            </h3>
            <button className="text-[var(--greek-gold)] text-sm font-medium hover:underline">
              Tout voir
            </button>
          </div>

          <div className="divide-y divide-[rgba(52,73,94,0.1)]">
            {activities.length > 0 ? (
              activities.map((activity) => (
                <div
                  key={`${activity.type}-${activity.id}`}
                  className="p-4 hover:bg-[var(--greek-cream)]/50 transition-colors flex items-center gap-4"
                >
                  <div
                    className={`p-3 rounded-full flex-shrink-0 
                    ${
                      activity.type === "Quiz"
                        ? "bg-purple-100 text-purple-600"
                        : activity.type === "Exercice"
                        ? "bg-orange-100 text-orange-600"
                        : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    {activity.type === "Quiz" && <Award className="w-5 h-5" />}
                    {activity.type === "Exercice" && (
                      <BookOpen className="w-5 h-5" />
                    )}
                    {activity.type === "Cours" && <Clock className="w-5 h-5" />}
                  </div>

                  <div className="flex-grow min-w-0">
                    <h4 className="font-semibold text-slate-800 truncate">
                      {activity.title}
                    </h4>
                    <p className="text-sm text-slate-500 flex items-center gap-2">
                      <span>{activity.type}</span>
                      <span>•</span>
                      <span>{formatDate(activity.date)}</span>
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    {activity.score ? (
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm font-bold 
                        ${
                          activity.status === "success"
                            ? "bg-green-100 text-green-700"
                            : activity.status === "failure"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {activity.score}
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-slate-600">
                        {activity.duration}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500">
                Aucune activité récente trouvée.
              </div>
            )}
          </div>
        </div>

        {/* Sidebar / Recommendations */}
        <div className="space-y-6">
          {/* Progress Summary */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 p-6">
            <h3 className="text-lg font-bold text-[var(--greek-blue)] mb-4 font-cinzel">
              Progression par Matière
            </h3>
            <div className="space-y-4">
              {/* Mock Data for subjects - replace with real data if available */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">
                    Mathématiques
                  </span>
                  <span className="text-[var(--greek-blue)] font-bold">
                    75%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-[var(--greek-blue)] h-2 rounded-full"
                    style={{ width: "75%" }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">Français</span>
                  <span className="text-green-600 font-bold">60%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: "60%" }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">
                    Histoire-Géo
                  </span>
                  <span className="text-orange-600 font-bold">40%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full"
                    style={{ width: "40%" }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">Sciences</span>
                  <span className="text-purple-600 font-bold">85%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{ width: "85%" }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Strengths & Weaknesses (Mocked) */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 p-6">
            <h3 className="text-lg font-bold text-[var(--greek-blue)] mb-4 font-[family-name:var(--font-display)]">
              Points Forts & Faibles
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    Géométrie
                  </h4>
                  <p className="text-xs text-slate-500">
                    Excellents résultats aux derniers quiz.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    Grammaire
                  </h4>
                  <p className="text-xs text-slate-500">
                    Progression constante.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    Calcul Mental
                  </h4>
                  <p className="text-xs text-slate-500">
                    Difficultés sur les tables de multiplication.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
