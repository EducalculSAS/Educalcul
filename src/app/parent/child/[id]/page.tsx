import { redirect } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Award, BookOpen, CheckCircle, TrendingUp } from "lucide-react";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { avatarUrl } from "@/lib/avatarUrl";
import ChildReportTabs from "@/components/parent/ChildReportTabs";
import GlassButton from "@/components/ui/GlassButton";

interface ActivityItem {
  id: string;
  type: "Quiz" | "Exercice" | "Cours";
  title: string;
  date: string;
  score?: string;
  status?: "success" | "failure" | "completed";
}

export default async function ChildReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: childId } = await params;
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "parent") redirect("/dashboard");

  const { data: subData } = await supabaseAdmin
    .from("subscriptions")
    .select("status")
    .eq("user_id", authUser.authId)
    .maybeSingle();
  const hasSub = subData?.status === "active";

  const { data: child } = await supabaseAdmin
    .from("users")
    .select("id, first_name, last_name, grade_level, child_username, avatar, parent_id")
    .eq("id", childId)
    .maybeSingle();

  if (!child || child.parent_id !== authUser.id) redirect("/parent/children");

  const [{ data: quizzes }, { data: exercises }, { data: courseProgress }] = await Promise.all([
    supabaseAdmin.from("user_quiz_attempts").select("id, completed_at, score, total_questions, quizzes(title)").eq("user_id", childId).order("completed_at", { ascending: false }).limit(30),
    supabaseAdmin.from("user_exercise_attempts").select("id, attempted_at, is_correct, exercises(title, difficulty_level, subject)").eq("user_id", childId).order("attempted_at", { ascending: false }).limit(30),
    supabaseAdmin.from("user_course_progress").select("id, created_at, course_id, courses(title, subject)").eq("user_id", childId).order("created_at", { ascending: false }).limit(20),
  ]);

  const allActivities: ActivityItem[] = [];
  let totalScore = 0, scoreCount = 0;

  (quizzes || []).forEach((q: any) => {
    const pct = q.total_questions > 0 ? (q.score / q.total_questions) * 100 : 0;
    totalScore += pct; scoreCount++;
    allActivities.push({ id: q.id, type: "Quiz", title: q.quizzes?.title || "Quiz", date: q.completed_at, score: `${q.score}/${q.total_questions}`, status: pct >= 50 ? "success" : "failure" });
  });

  const subjectMap: Record<string, { correct: number; total: number }> = {};
  (exercises || []).forEach((e: any) => {
    allActivities.push({ id: e.id, type: "Exercice", title: e.exercises?.title || "Exercice", date: e.attempted_at, score: e.is_correct ? "Correct" : "Incorrect", status: e.is_correct ? "success" : "failure" });
    const subj = e.exercises?.subject || "Mathématiques";
    if (!subjectMap[subj]) subjectMap[subj] = { correct: 0, total: 0 };
    subjectMap[subj].total++;
    if (e.is_correct) subjectMap[subj].correct++;
  });

  (courseProgress || []).forEach((c: any) => {
    allActivities.push({ id: c.id, type: "Cours", title: c.course?.title || "Cours", date: c.created_at, status: "completed" });
    const subj = c.course?.subject || "Mathématiques";
    if (!subjectMap[subj]) subjectMap[subj] = { correct: 0, total: 0 };
  });

  allActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const correctEx = (exercises || []).filter((e: any) => e.is_correct).length;
  const totalEx = exercises?.length || 0;

  const stats = {
    totalTime: 0,
    avgScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
    totalActivities: allActivities.length,
    quizzesTaken: quizzes?.length || 0,
    exercisesDone: totalEx,
    successRate: totalEx > 0 ? Math.round((correctEx / totalEx) * 100) : 0,
  };

  const subjectStats = Object.entries(subjectMap).map(([subject, v]) => ({ subject, ...v })).sort((a, b) => b.total - a.total);

  const avatar = avatarUrl(child.avatar, "/avatars/avatar1.png");

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-12">
      {/* Hero Header */}
      <div className="bg-[var(--greek-blue)] text-white pt-24 pb-12 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="mb-6">
            <GlassButton href="/parent/children" variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" /> Mes enfants
            </GlassButton>
          </div>
          <div className="flex items-center gap-5">
            <div className="relative w-16 h-16 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center overflow-hidden shrink-0">
              {child.avatar && avatar
                ? <Image src={avatar} alt={child.first_name} fill sizes="64px" className="object-cover" />
                : <span className="text-2xl font-bold text-white">{child.first_name.charAt(0)}</span>}
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-[family-name:var(--font-display)] font-bold">
                {child.first_name} {child.last_name}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">{child.grade_level || "Niveau ?"}</span>
                {child.child_username && <span className="text-white/60 text-sm">@{child.child_username}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4">
        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Exercices", value: stats.exercisesDone, icon: <BookOpen className="w-5 h-5" />, color: "bg-orange-50 text-orange-600" },
            { label: "Réussite exos", value: `${stats.successRate}%`, icon: <CheckCircle className="w-5 h-5" />, color: "bg-green-50 text-green-600" },
            { label: "Quiz", value: stats.quizzesTaken, icon: <Award className="w-5 h-5" />, color: "bg-purple-50 text-purple-600" },
            { label: "Score moyen quiz", value: stats.avgScore > 0 ? `${stats.avgScore}%` : "—", icon: <TrendingUp className="w-5 h-5" />, color: "bg-blue-50 text-blue-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
              <div className="flex items-start justify-between mb-2">
                <div className={`p-2 rounded-xl ${s.color}`}>{s.icon}</div>
                <span className="text-2xl font-bold text-[var(--greek-blue)]">{s.value}</span>
              </div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        <ChildReportTabs
          childId={childId}
          childFirstName={child.first_name}
          activities={allActivities}
          stats={stats}
          subjectStats={subjectStats}
          hasSub={hasSub}
        />
      </div>
    </div>
  );
}
