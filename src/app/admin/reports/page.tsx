"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users, BookOpen, MessageSquare, TrendingUp, Activity,
  BarChart2, UserPlus, CreditCard, Dumbbell, Gift, RefreshCw, Clock,
} from "lucide-react";

const REFRESH_SEC = 30;

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_SEC);

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const r = await fetch(`/api/admin/reports?t=${Date.now()}`, { cache: "no-store" });
      const d = await r.json();
      setData(d);
      setLastUpdated(new Date());
      setCountdown(REFRESH_SEC);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const auto = setInterval(() => fetchData(true), REFRESH_SEC * 1000);
    const tick = setInterval(() => setCountdown(c => c > 1 ? c - 1 : REFRESH_SEC), 1000);
    return () => { clearInterval(auto); clearInterval(tick); };
  }, [fetchData]);

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--greek-blue)]" />
    </div>
  );
  if (!data) return <div className="p-6 text-red-500">Erreur de chargement.</div>;

  const { stats, charts, recent_activity } = data;
  const maxCount = Math.max(...charts.registrations.map((r: any) => r.count), 1);

  const activityIcon = (type: string) => {
    if (type === "forum") return <MessageSquare size={14} />;
    if (type === "exercice") return <Dumbbell size={14} />;
    return <UserPlus size={14} />;
  };
  const activityColor = (type: string) => {
    if (type === "forum") return "bg-purple-100 text-purple-600";
    if (type === "exercice") return "bg-green-100 text-green-600";
    return "bg-blue-100 text-blue-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[var(--greek-gold)]/30 p-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] flex items-center gap-3">
            <BarChart2 className="text-[var(--greek-gold)]" size={30} />
            Rapports & Analytics
          </h1>
          <p className="text-[var(--greek-bronze)] mt-1">Vue d'ensemble des performances et de l'activité</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {lastUpdated && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-400 flex items-center gap-1 justify-end">
                <Clock size={11} />
                {lastUpdated.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
              <p className="text-xs text-gray-300">actualisation dans {countdown}s</p>
            </div>
          )}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Stats row 1 — Utilisateurs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Utilisateurs" value={stats.total_users} sub={`+${stats.new_today} aujourd'hui`} icon={<Users size={20} />} color="bg-blue-50 text-blue-600" />
        <StatCard title="Parents" value={stats.total_parents} sub={`+${stats.new_this_week} cette semaine`} icon={<UserPlus size={20} />} color="bg-indigo-50 text-indigo-600" />
        <StatCard title="Élèves" value={stats.total_children} icon={<Users size={20} />} color="bg-violet-50 text-violet-600" />
        <StatCard title="Abonnements actifs" value={stats.active_subs} icon={<CreditCard size={20} />} color="bg-green-50 text-green-600" />
      </div>

      {/* Stats row 2 — Contenu & activité */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Cours publiés" value={stats.total_courses} icon={<BookOpen size={20} />} color="bg-orange-50 text-orange-600" />
        <StatCard title="Exercices" value={stats.total_exercises} sub={`${stats.exercise_attempts} tentatives`} icon={<Dumbbell size={20} />} color="bg-amber-50 text-amber-600" />
        <StatCard title="Quiz" value={stats.total_quizzes} sub={stats.avg_quiz_score !== null ? `Moy. ${stats.avg_quiz_score}/20` : "Aucune tentative"} icon={<BookOpen size={20} />} color="bg-yellow-50 text-yellow-600" />
        <StatCard title="Progressions cours" value={stats.course_progress} icon={<TrendingUp size={20} />} color="bg-teal-50 text-teal-600" />
      </div>

      {/* Stats row 3 — Forum & parrainage */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Sujets forum" value={stats.forum_posts} icon={<MessageSquare size={20} />} color="bg-purple-50 text-purple-600" />
        <StatCard title="Commentaires forum" value={stats.forum_comments} icon={<MessageSquare size={20} />} color="bg-pink-50 text-pink-600" />
        <StatCard title="Codes parrainage" value={stats.parrainage_codes} icon={<Gift size={20} />} color="bg-rose-50 text-rose-600" />
        <StatCard title="Utilisations parrainage" value={stats.parrainage_uses} icon={<Gift size={20} />} color="bg-red-50 text-red-600" />
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Bar chart — inscriptions par semaine */}
        <div className="bg-white p-6 rounded-[20px] shadow-sm border border-[var(--greek-gold)]/15">
          <h3 className="text-base font-bold text-[var(--greek-blue)] mb-6 flex items-center gap-2">
            <TrendingUp size={18} className="text-[var(--greek-gold)]" />
            Inscriptions — 8 dernières semaines
          </h3>
          <div className="flex items-end gap-2 h-48">
            {charts.registrations.map((item: any, i: number) => {
              const heightPct = maxCount > 0 ? Math.max((item.count / maxCount) * 100, item.count > 0 ? 4 : 1) : 1;
              const label = new Date(item.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
              return (
                <div key={i} className="flex flex-col items-center flex-1 group">
                  <div className="relative w-full flex flex-col justify-end" style={{ height: "180px" }}>
                    {item.count > 0 && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {item.count}
                      </div>
                    )}
                    <div
                      className="w-full rounded-t-md bg-[var(--greek-blue)]/20 group-hover:bg-[var(--greek-blue)] transition-colors"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1.5 font-medium">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white p-6 rounded-[20px] shadow-sm border border-[var(--greek-gold)]/15">
          <h3 className="text-base font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
            <Activity size={18} className="text-[var(--greek-gold)]" />
            Activité récente
          </h3>
          <div className="space-y-3">
            {recent_activity.length > 0 ? recent_activity.map((item: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-[var(--greek-gold)]/15">
                <div className={`p-1.5 rounded-lg shrink-0 ${activityColor(item.type)}`}>
                  {activityIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {item.type} · {new Date(item.timestamp).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-gray-400 text-sm italic py-4 text-center">Aucune activité récente.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ title, value, sub, icon, color }: { title: string; value: number; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-[var(--greek-gold)]/15 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl ${color}`}>{icon}</div>
        <span className="text-2xl font-bold text-[var(--greek-blue)]">{value}</span>
      </div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
