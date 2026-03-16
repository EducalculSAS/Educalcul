"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PieChart,
  Activity,
  Clock,
  History,
  Award,
  BarChart2,
  Lock,
  ArrowRight,
  Info,
  Users,
  TrendingUp,
  BookOpen,
  CheckCircle,
  Plus,
} from "lucide-react";
import MathLoader from "@/components/MathLoader";

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

interface CourseViewData {
  courses: CourseData | null;
}

interface QuizAttempt {
  completed_at: string;
  score: number;
  total_questions: number;
  quizzes: QuizData | null;
}

interface ExerciseAttempt {
  attempted_at: string;
  is_correct: boolean;
  exercises: ExerciseData | null;
}

interface SessionData {
  session_ended_at: string;
  user_course_views: CourseViewData | null;
}

interface UserCourseView {
  id: string;
}

interface UserCourseSession {
  duration_seconds: number;
}

interface ChildStats {
  progress: number;
  activityCount7d: number;
  timeSpent7d: { hours: number; minutes: number };
  lastActivity: {
    type: string;
    title: string;
    date: string;
    score?: string | null;
    relativeTime: string;
  } | null;
  badges: {
    icon: string;
    title: string;
    key: string;
  }[];
  exerciseCount: number;
  quizCount: number;
  successRate: number;
}

interface ChildWithStats {
  id: string;
  first_name: string;
  last_name: string;
  grade_level: string | null;
  avatar?: string;
  stats: ChildStats | null;
  loading: boolean;
  error: string | null;
}

const formatDuration = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return { hours, minutes };
};

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "À l'instant";
  if (diffInSeconds < 3600)
    return `Il y a ${Math.floor(diffInSeconds / 60)} min`;
  if (diffInSeconds < 86400)
    return `Il y a ${Math.floor(diffInSeconds / 3600)} h`;
  return `Il y a ${Math.floor(diffInSeconds / 86400)} j`;
};

export default function ParentDashboard() {
  const router = useRouter();
  const [children, setChildren] = useState<ChildWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Parent");
  const [canSeeReports, setCanSeeReports] = useState(false);

  useEffect(() => {
    const checkUserAndFetchChildren = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/connexion");
        return;
      }

      // Fetch parent details
      const { data: userData } = await supabase
        .from("users")
        .select("first_name, role")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (userData) {
        if (userData.role !== "parent") {
          router.push("/dashboard");
          return;
        }
        setUserName(userData.first_name || "Parent");
      }

      // Check subscription
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("plan_id, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      // If active sub and not free (assuming 'free' is the basic plan id), allow reports
      // Adjust logic based on your actual plan IDs.
      // For now, we'll assume any active subscription except 'free' gives access,
      // or if you want to be generous for demo, set true.
      // Based on PHP dashboard, it checks 'detailed_reports' permission.
      // We'll mimic this:
      if (subData && subData.plan_id !== "free") {
        setCanSeeReports(true);
      } else {
        setCanSeeReports(false);
      }
      // fallback for demo if no table exists yet
      // setCanSeeReports(true);

      // Fetch children
      const { data: parentRecord } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (!parentRecord) {
        setLoading(false);
        return;
      }

      const { data: childrenData, error: childrenError } = await supabase
        .from("users")
        .select("id, first_name, last_name, grade_level, avatar")
        .eq("role", "child")
        .eq("parent_id", parentRecord.id)
        .order("first_name", { ascending: true });

      if (childrenError) {
        console.error("Error fetching children:", childrenError);
        setLoading(false);
        return;
      }

      const childrenWithLoading = (childrenData || []).map((child: any) => ({
        ...child,
        stats: null,
        loading: true,
        error: null,
      }));

      setChildren(childrenWithLoading);
      setLoading(false);

      // Fetch stats for each child
      childrenWithLoading.forEach((child: any) => {
        fetchChildStats(child.id).then((stats) => {
          setChildren((prev) =>
            prev.map((c) =>
              c.id === child.id ? { ...c, stats, loading: false } : c
            )
          );
        });
      });
    };

    checkUserAndFetchChildren();
  }, [router]);

  const fetchChildStats = async (childId: string): Promise<ChildStats> => {
    const date7DaysAgo = new Date();
    date7DaysAgo.setDate(date7DaysAgo.getDate() - 7);
    const date7DaysAgoIso = date7DaysAgo.toISOString();

    // 1. Activity Count (7d)
    const { data: views } = await supabase
      .from("user_course_views")
      .select("id")
      .eq("user_id", childId)
      .returns<UserCourseView[]>();

    const viewIds = views?.map((v) => v.id) || [];
    let sessionsCount = 0;
    let sessionsDuration = 0;

    if (viewIds.length > 0) {
      const { data: sessions } = await supabase
        .from("user_course_sessions")
        .select("duration_seconds")
        .in("user_course_view_id", viewIds)
        .gte("session_ended_at", date7DaysAgoIso)
        .returns<UserCourseSession[]>();

      sessionsCount = sessions?.length || 0;
      sessionsDuration =
        sessions?.reduce(
          (acc, curr) => acc + (curr.duration_seconds || 0),
          0
        ) || 0;
    }

    const { count: quizCount } = await supabase
      .from("user_quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", childId)
      .gte("completed_at", date7DaysAgoIso);

    // Total stats (not just 7d) for the cards
    const { count: totalQuizCount } = await supabase
      .from("user_quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", childId);

    const { count: exerciseCount } = await supabase
      .from("user_exercise_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", childId)
      .gte("attempted_at", date7DaysAgoIso);

    const { count: totalExerciseCount } = await supabase
      .from("user_exercise_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", childId);

    // Success Rate Calculation
    const { data: correctExercises } = await supabase
      .from("user_exercise_attempts")
      .select("id")
      .eq("user_id", childId)
      .eq("is_correct", true);

    const totalAttempts = totalExerciseCount || 0;
    const successRate =
      totalAttempts > 0
        ? Math.round(((correctExercises?.length || 0) / totalAttempts) * 100)
        : 0;

    const activityCount7d =
      sessionsCount + (quizCount || 0) + (exerciseCount || 0);

    // 3. Time Spent (7d)
    const timeSpent7d = formatDuration(sessionsDuration);

    // 4. Last Activity
    let lastActivity = null;

    const { data: lastQuiz } = await supabase
      .from("user_quiz_attempts")
      .select("completed_at, score, total_questions, quizzes(title)")
      .eq("user_id", childId)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle<QuizAttempt>();

    const { data: lastExercise } = await supabase
      .from("user_exercise_attempts")
      .select("attempted_at, is_correct, exercises(title)")
      .eq("user_id", childId)
      .order("attempted_at", { ascending: false })
      .limit(1)
      .maybeSingle<ExerciseAttempt>();

    let lastCourse = null;
    if (viewIds.length > 0) {
      const { data: lastSession } = await supabase
        .from("user_course_sessions")
        .select("session_ended_at, user_course_views(courses(title))")
        .in("user_course_view_id", viewIds)
        .order("session_ended_at", { ascending: false })
        .limit(1)
        .maybeSingle<SessionData>();

      if (lastSession) {
        const title = lastSession.user_course_views?.courses?.title || "Cours";
        lastCourse = {
          type: "Cours",
          title: title,
          date: lastSession.session_ended_at,
          score: null,
        };
      }
    }

    const activities = [];
    if (lastQuiz) {
      activities.push({
        type: "Quiz",
        title: lastQuiz.quizzes?.title || "Quiz",
        date: lastQuiz.completed_at,
        score: `${lastQuiz.score}/${lastQuiz.total_questions}`,
      });
    }
    if (lastExercise) {
      activities.push({
        type: "Exercice",
        title: lastExercise.exercises?.title || "Exercice",
        date: lastExercise.attempted_at,
        score: lastExercise.is_correct ? "Correct" : "Incorrect",
      });
    }
    if (lastCourse) {
      activities.push(lastCourse);
    }

    activities.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    if (activities.length > 0) {
      const best = activities[0];
      lastActivity = {
        ...best,
        relativeTime: formatRelativeTime(best.date),
      };
    } else {
      lastActivity = {
        type: "Aucune",
        title: "Aucune activité récente",
        date: "",
        relativeTime: "",
        score: null,
      };
    }

    // 5. Badges
    const badges = [];
    if (sessionsCount > 0)
      badges.push({
        key: "course_start",
        icon: "play-circle",
        title: "Premier Chapitre Commencé",
      });
    if ((quizCount || 0) > 0)
      badges.push({
        key: "quiz_pass",
        icon: "check-double",
        title: "Premier Quiz Réussi",
      });

    const displayBadges = badges.slice(0, 4);

    return {
      progress: Math.min(100, Math.round(activityCount7d * 2)),
      activityCount7d,
      timeSpent7d,
      lastActivity,
      badges: displayBadges,
      exerciseCount: totalExerciseCount || 0,
      quizCount: totalQuizCount || 0,
      successRate,
    };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <MathLoader />
      </div>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-[var(--greek-blue)] mb-3 font-[family-name:var(--font-display)] drop-shadow-sm">
          <Activity className="inline-block w-10 h-10 mr-3 mb-1 text-[var(--greek-gold)]" />
          Tableau de Bord
        </h1>
        <p className="text-gray-600 text-lg mb-8">
          Bienvenue, {userName}. Suivez les progrès de vos enfants.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/parent/children"
            className="inline-flex items-center px-6 py-3 bg-[var(--greek-blue)] text-white rounded-xl hover:bg-[var(--greek-blue)] transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-bold"
          >
            <Users className="w-5 h-5 mr-2" />
            Gérer mes enfants
          </Link>
          <Link
            href="/parent/add-child"
            className="inline-flex items-center px-6 py-3 bg-[var(--greek-gold)] text-white rounded-xl hover:bg-yellow-600 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-bold"
          >
            <Plus className="w-5 h-5 mr-2" />
            Ajouter un enfant
          </Link>
        </div>
      </div>

      {children.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-md border border-white/50 text-[var(--greek-blue)] p-8 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center max-w-2xl mx-auto">
          <p className="text-xl mb-4 font-[family-name:var(--font-display)]">
            Vous n'avez pas encore ajouté d'enfant.
          </p>
          <Link
            href="/parent/add-child"
            className="inline-block bg-[var(--greek-gold)] text-white px-6 py-3 rounded-lg font-bold hover:bg-yellow-600 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            Commencer maintenant
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {children.map((child) => (
            <div
              key={child.id}
              className="bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 overflow-hidden hover:-translate-y-1 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300 flex flex-col group"
            >
              {/* Card Header */}
              <div className="p-6 border-b border-[rgba(52,73,94,0.1)] bg-gradient-to-r from-[var(--greek-cream)]/50 to-transparent">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-1">
                      {child.first_name} {child.last_name}
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--greek-blue)]/10 text-[var(--greek-blue)] border border-[var(--greek-blue)]/20">
                      {child.grade_level || "Niveau non défini"}
                    </span>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-white shadow-sm flex items-center justify-center text-[var(--greek-blue)] group-hover:scale-110 transition-transform duration-300 overflow-hidden border-2 border-[var(--greek-gold)]/20">
                    {child.avatar ? (
                      <img
                        src={`/avatars/${child.avatar}`}
                        alt={child.first_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-bold text-lg">
                        {child.first_name.charAt(0)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 flex-grow">
                {child.loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin h-6 w-6 border-b-2 border-[var(--greek-blue)] rounded-full"></div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-white/60 rounded-xl border border-white/60 text-center shadow-sm">
                        <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
                        <div className="text-lg font-bold text-gray-800">
                          {child.stats?.exerciseCount || 0}
                        </div>
                        <div className="text-xs text-gray-500">
                          Exercices faits
                        </div>
                      </div>
                      <div className="p-3 bg-white/60 rounded-xl border border-white/60 text-center shadow-sm">
                        <TrendingUp className="w-5 h-5 text-[var(--greek-gold)] mx-auto mb-1" />
                        <div className="text-lg font-bold text-gray-800">
                          {child.stats?.successRate || 0}%
                        </div>
                        <div className="text-xs text-gray-500">Réussite</div>
                      </div>
                    </div>

                    {/* Last Activity */}
                    <div className="border-t border-[rgba(52,73,94,0.1)] pt-4">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                        Dernière activité
                      </h4>
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg shadow-sm ${child.stats?.lastActivity?.type === "Quiz"
                            ? "bg-purple-100 text-purple-600"
                            : child.stats?.lastActivity?.type === "Exercice"
                              ? "bg-green-100 text-green-600"
                              : "bg-blue-100 text-blue-600"
                            }`}
                        >
                          {child.stats?.lastActivity?.type === "Quiz" ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : child.stats?.lastActivity?.type === "Exercice" ? (
                            <BookOpen className="w-4 h-4" />
                          ) : (
                            <Activity className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800 line-clamp-1">
                            {child.stats?.lastActivity?.title ||
                              "Aucune activité"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {child.stats?.lastActivity?.relativeTime}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="p-4 bg-[var(--greek-cream)]/30 border-t border-[rgba(52,73,94,0.1)]">
                {canSeeReports ? (
                  <Link
                    href={`/parent/child/${child.id}`}
                    className="flex items-center justify-center w-full py-2.5 px-4 bg-[var(--greek-blue)] text-white rounded-lg hover:bg-[var(--greek-blue)] transition-all font-medium text-sm group shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  >
                    Voir le rapport complet
                    <ArrowRight className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" />
                  </Link>
                ) : (
                  <Link
                    href="/parent/subscription"
                    className="flex items-center justify-center w-full py-2.5 px-4 bg-gray-100 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-200 transition-all font-medium text-sm"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Débloquer le rapport
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
