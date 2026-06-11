"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Clock, Award, BookOpen, CheckCircle, XCircle,
  TrendingUp, Activity, Brain, Sparkles, RotateCcw,
  Star, Lock, CalendarClock,
} from "lucide-react";
import AppAdminLoader from "@/components/AppAdminLoader";
import { avatarUrl } from "@/lib/avatarUrl";

interface ActivityItem {
  id: string;
  type: "Quiz" | "Exercice" | "Cours";
  title: string;
  date: string;
  score?: string;
  status?: "success" | "failure" | "completed";
  duration?: string;
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function parseBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-bold text-[var(--greek-blue)]">{part}</strong>
    ) : (
      part
    )
  );
}

function renderAnalysis(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();

    if (!line) {
      elements.push(<div key={i} className="h-2" />);
      return;
    }

    // ### or #### header lines
    if (line.startsWith("#")) {
      const content = line.replace(/^#+\s*/, "").replace(/\*\*/g, "");
      elements.push(
        <h3
          key={i}
          className="text-sm font-bold text-[var(--greek-blue)] mt-6 mb-2 font-[family-name:var(--font-display)] flex items-center gap-2 uppercase tracking-wide"
        >
          <span className="w-1 h-4 bg-[var(--greek-gold)] rounded-full inline-block flex-shrink-0" />
          {content}
        </h3>
      );
      return;
    }

    // Lines that are ONLY bold text → section header
    if (/^\*\*[^*]+\*\*\s*$/.test(line)) {
      const content = line.replace(/\*\*/g, "");
      elements.push(
        <h4
          key={i}
          className="font-bold text-[var(--greek-blue)] mt-5 mb-1.5 text-sm flex items-center gap-2"
        >
          <span className="w-4 h-[2px] bg-[var(--greek-gold)] inline-block flex-shrink-0 rounded-full" />
          {content}
        </h4>
      );
      return;
    }

    // Bullet points
    if (line.startsWith("- ") || line.startsWith("• ") || line.startsWith("* ")) {
      const content = line.replace(/^[-•*]\s+/, "");
      elements.push(
        <div key={i} className="flex gap-2.5 mt-2 ml-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--greek-gold)] mt-[7px] flex-shrink-0" />
          <p className="text-sm text-gray-700 leading-relaxed">{parseBold(content)}</p>
        </div>
      );
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-sm text-gray-700 leading-relaxed mt-1">
        {parseBold(line)}
      </p>
    );
  });

  return <>{elements}</>;
}

const STORAGE_KEY = (id: string) => `ai_report_${id}`;
const getTodayStr = () => new Date().toDateString();

export default function ChildReportPage() {
  const params = useParams();
  const router = useRouter();
  const childId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [child, setChild] = useState<any>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState({ totalTime: 0, avgScore: 0, totalActivities: 0, quizzesTaken: 0, exercisesDone: 0, successRate: 0 });
  const [subjectStats, setSubjectStats] = useState<{ subject: string; correct: number; total: number }[]>([]);

  const [tab, setTab] = useState<"activite" | "ia">("activite");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisStats, setAnalysisStats] = useState<any>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [canRegenerate, setCanRegenerate] = useState(true);
  const [hasSub, setHasSub] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/connexion"); return; }

      const { data: parentRecord } = await supabase.from("users").select("id").eq("auth_id", user.id).eq("role", "parent").maybeSingle();
      if (!parentRecord) { router.push("/dashboard"); return; }

      // Check subscription
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      setHasSub(subData?.status === "active");

      const { data: childData, error } = await supabase
        .from("users")
        .select("id, first_name, last_name, grade_level, child_username, avatar, parent_id")
        .eq("id", childId)
        .maybeSingle();

      if (error || !childData || childData.parent_id !== parentRecord.id) {
        router.push("/parent/children");
        return;
      }

      setChild(childData);

      // Load saved analysis from localStorage
      try {
        const saved = localStorage.getItem(STORAGE_KEY(childId));
        if (saved) {
          const parsed = JSON.parse(saved);
          setAnalysis(parsed.analysis);
          setAnalysisStats(parsed.stats);
          setGeneratedAt(parsed.generatedAt);
          if (new Date(parsed.generatedAt).toDateString() === getTodayStr()) {
            setCanRegenerate(false);
          }
        }
      } catch {}

      // Fetch data in parallel
      const [{ data: quizzes }, { data: exercises }, { data: courseProgress }] = await Promise.all([
        supabase.from("user_quiz_attempts").select("id, completed_at, score, total_questions, quizzes(title)").eq("user_id", childId).order("completed_at", { ascending: false }).limit(30),
        supabase.from("user_exercise_attempts").select("id, attempted_at, is_correct, exercises(title, difficulty_level, subject)").eq("user_id", childId).order("attempted_at", { ascending: false }).limit(30),
        supabase.from("user_course_progress").select("id, created_at, course_id, courses(title, subject)").eq("user_id", childId).order("created_at", { ascending: false }).limit(20),
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
      setActivities(allActivities);

      const correctEx = (exercises || []).filter((e: any) => e.is_correct).length;
      const totalEx = exercises?.length || 0;

      setStats({
        totalTime: 0,
        avgScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
        totalActivities: allActivities.length,
        quizzesTaken: quizzes?.length || 0,
        exercisesDone: totalEx,
        successRate: totalEx > 0 ? Math.round((correctEx / totalEx) * 100) : 0,
      });

      setSubjectStats(Object.entries(subjectMap).map(([subject, v]) => ({ subject, ...v })).sort((a, b) => b.total - a.total));
      setLoading(false);
    })();
  }, [childId]);

  const loadAnalysis = async () => {
    if (analysisLoading) return;
    setAnalysisLoading(true);
    try {
      const res = await fetch(`/api/parent/child-analysis?childId=${childId}`);
      const data = await res.json();
      setAnalysis(data.analysis);
      setAnalysisStats(data.stats);
      const now = new Date().toISOString();
      setGeneratedAt(now);
      setCanRegenerate(false);
      // Persist in localStorage
      try {
        localStorage.setItem(STORAGE_KEY(childId), JSON.stringify({ analysis: data.analysis, stats: data.stats, generatedAt: now }));
      } catch {}
    } catch {
      setAnalysis("Erreur lors de l'analyse. Vérifiez que l'IA est disponible.");
    } finally {
      setAnalysisLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><AppAdminLoader /></div>;
  if (!child) return null;

  const formattedGeneratedAt = generatedAt
    ? new Date(generatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-12">
      {/* Hero Header */}
      <div className="bg-[var(--greek-blue)] text-white pt-24 pb-12 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="container mx-auto max-w-6xl relative z-10">
          <Link href="/parent/children" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Mes enfants
          </Link>
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center overflow-hidden shrink-0">
              {child.avatar
                ? <img src={avatarUrl(child.avatar, "/avatars/avatar1.png")!} alt={child.first_name} className="w-full h-full object-cover" />
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
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
              <div className="flex items-start justify-between mb-2">
                <div className={`p-2 rounded-xl ${s.color}`}>{s.icon}</div>
                <span className="text-2xl font-bold text-[var(--greek-blue)]">{s.value}</span>
              </div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[var(--greek-gold)]/10 rounded-xl w-fit mb-6">
          {([["activite", "Activité"], ["ia", "Analyse IA"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); if (key === "ia" && !analysis && hasSub) loadAnalysis(); }}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === key ? "bg-white shadow-sm text-[var(--greek-blue)]" : "text-gray-500 hover:text-gray-700"}`}>
              {label}
              {key === "ia" && !hasSub && <Lock className="inline w-3 h-3 ml-1 mb-0.5 opacity-50" />}
            </button>
          ))}
        </div>

        {/* Tab: Activité */}
        {tab === "activite" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[rgba(197,161,72,0.25)]">
                <h3 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
                  Historique d'activité ({activities.length})
                </h3>
              </div>
              <div className="divide-y divide-[var(--greek-gold)]/10 max-h-[600px] overflow-y-auto">
                {activities.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">Aucune activité enregistrée.</div>
                ) : activities.map(a => (
                  <div key={`${a.type}-${a.id}`} className="p-4 hover:bg-gray-50 transition-colors flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl shrink-0 ${a.type === "Quiz" ? "bg-purple-100 text-purple-600" : a.type === "Exercice" ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"}`}>
                      {a.type === "Quiz" ? <Award className="w-4 h-4" /> : a.type === "Exercice" ? <BookOpen className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{a.title}</p>
                      <p className="text-xs text-gray-400">{a.type} · {formatDate(a.date)}</p>
                    </div>
                    {a.score && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${a.status === "success" ? "bg-green-100 text-green-700" : a.status === "failure" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                        {a.score}
                      </span>
                    )}
                    {a.status === "completed" && !a.score && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 shrink-0">Consulté</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
                <h3 className="font-bold text-[var(--greek-blue)] mb-4 font-[family-name:var(--font-display)] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[var(--greek-gold)]" />
                  Réussite par matière
                </h3>
                {subjectStats.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Aucune donnée disponible</p>
                ) : subjectStats.map(s => {
                  const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
                  return (
                    <div key={s.subject} className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700 truncate">{s.subject}</span>
                        <span className={`font-bold ml-2 ${pct >= 70 ? "text-green-600" : pct >= 40 ? "text-orange-600" : "text-red-600"}`}>{pct}%</span>
                      </div>
                      <div className="w-full bg-[var(--greek-gold)]/10 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-orange-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{s.correct}/{s.total} corrects</p>
                    </div>
                  );
                })}
              </div>

              <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
                <h3 className="font-bold text-[var(--greek-blue)] mb-4 font-[family-name:var(--font-display)] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[var(--greek-gold)]" />
                  Résumé
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Total activités</span><span className="font-bold text-gray-800">{stats.totalActivities}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Exercices réussis</span><span className="font-bold text-green-600">{Math.round(stats.exercisesDone * stats.successRate / 100)} / {stats.exercisesDone}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Quiz complétés</span><span className="font-bold text-gray-800">{stats.quizzesTaken}</span></div>
                  {stats.avgScore > 0 && <div className="flex justify-between"><span className="text-gray-500">Score moyen quiz</span><span className={`font-bold ${stats.avgScore >= 70 ? "text-green-600" : stats.avgScore >= 50 ? "text-orange-500" : "text-red-500"}`}>{stats.avgScore}%</span></div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Analyse IA */}
        {tab === "ia" && (
          <>
            {/* No subscription */}
            {!hasSub ? (
              <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-10 text-center max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-[var(--greek-gold)]/10 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-7 h-7 text-[var(--greek-gold)]" />
                </div>
                <h3 className="font-bold text-[var(--greek-blue)] text-lg font-[family-name:var(--font-display)] mb-2">
                  Fonctionnalité Premium
                </h3>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                  L'analyse IA d'EpsiAI est disponible avec un abonnement actif. Passez à un plan supérieur pour obtenir des rapports personnalisés sur la progression de {child.first_name}.
                </p>
                <Link
                  href="/parent/subscription"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--greek-blue)] text-white rounded-xl font-bold text-sm hover:bg-blue-800 transition-colors shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Voir les abonnements
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main analysis card */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm overflow-hidden">
                  {/* Card header */}
                  <div className="px-6 py-4 border-b border-[rgba(197,161,72,0.25)] bg-gradient-to-r from-[var(--greek-blue)]/5 to-transparent flex items-center justify-between">
                    <h3 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] flex items-center gap-2">
                      <Brain className="w-5 h-5 text-[var(--greek-gold)]" />
                      Analyse IA — {child.first_name}
                    </h3>
                    <div className="flex items-center gap-3">
                      {formattedGeneratedAt && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <CalendarClock className="w-3 h-3" />
                          {formattedGeneratedAt}
                        </span>
                      )}
                      <button
                        onClick={loadAnalysis}
                        disabled={analysisLoading || !canRegenerate}
                        title={!canRegenerate ? "Rapport déjà généré aujourd'hui" : "Régénérer"}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[var(--greek-blue)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${analysisLoading ? "animate-spin" : ""}`} />
                        {!canRegenerate ? "Disponible demain" : "Régénérer"}
                      </button>
                    </div>
                  </div>

                  <div className="p-6">
                    {analysisLoading ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--greek-gold)] flex items-center justify-center animate-pulse">
                          <Star className="w-6 h-6 text-[var(--greek-blue)] fill-current" />
                        </div>
                        <p className="text-gray-500 text-sm">EpsiAI analyse les données de {child.first_name}…</p>
                        <p className="text-gray-300 text-xs">Cela peut prendre quelques secondes</p>
                      </div>
                    ) : analysis ? (
                      <div className="leading-relaxed">
                        {renderAnalysis(analysis)}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Brain className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm mb-4">Lancez l'analyse pour obtenir des conseils personnalisés.</p>
                        <button onClick={loadAnalysis} className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-[var(--greek-blue)] text-white rounded-xl font-bold text-sm hover:bg-blue-800 transition-colors">
                          <Sparkles className="w-4 h-4" /> Analyser maintenant
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Side panel */}
                <div className="space-y-5">
                  {analysisStats && (
                    <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
                      <h3 className="font-bold text-[var(--greek-blue)] mb-4 font-[family-name:var(--font-display)] text-sm flex items-center gap-2">
                        <Activity className="w-4 h-4 text-[var(--greek-gold)]" />
                        Données analysées
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">Exercices</span><span className="font-bold">{analysisStats.totalEx}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Taux de réussite</span><span className={`font-bold ${analysisStats.successRate >= 70 ? "text-green-600" : "text-orange-500"}`}>{analysisStats.successRate}%</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Quiz</span><span className="font-bold">{analysisStats.totalQuiz}</span></div>
                        {analysisStats.avgQuizScore !== null && <div className="flex justify-between"><span className="text-gray-500">Score moyen quiz</span><span className="font-bold">{analysisStats.avgQuizScore}%</span></div>}
                        <div className="flex justify-between"><span className="text-gray-500">Cours consultés</span><span className="font-bold">{analysisStats.totalCourses}</span></div>
                      </div>
                    </div>
                  )}

                  {/* Rate limit info */}
                  {!canRegenerate && (
                    <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 flex items-start gap-3">
                      <CalendarClock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 leading-relaxed">
                        <strong>1 rapport par jour.</strong> Le prochain rapport sera disponible demain.
                      </p>
                    </div>
                  )}

                  <div className="bg-[var(--greek-blue)]/5 rounded-2xl border border-[var(--greek-blue)]/10 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-[var(--greek-gold)]" />
                      <span className="text-sm font-bold text-[var(--greek-blue)]">À propos de l'analyse</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      L'analyse est générée par EpsiAI, l'IA d'Educalcul. Elle est basée sur les 30 dernières activités de {child.first_name}.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
