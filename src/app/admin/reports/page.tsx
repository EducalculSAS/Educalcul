"use client";

import { useState, useEffect } from "react";
import {
  Users,
  BookOpen,
  FileText,
  MessageSquare,
  TrendingUp,
  Activity,
  Clock,
  UserPlus,
  BarChart2,
  PieChart,
  Globe,
} from "lucide-react";

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await fetch("/api/admin/reports");
      if (!res.ok) throw new Error("Failed to fetch reports");
      const jsonData = await res.json();
      setData(jsonData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--greek-blue)]"></div>
      </div>
    );
  }

  if (!data)
    return <div className="p-6">Erreur de chargement des données.</div>;

  const { stats, charts, recent_activity } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[var(--greek-gold)]/30 p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pattern-grid-lg pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-[var(--greek-blue)] mb-2 font-[family-name:var(--font-display)] flex items-center gap-3">
            <BarChart2 className="text-[var(--greek-gold)]" size={32} />
            Rapports & Analytics
          </h1>
          <p className="text-[var(--greek-bronze)] text-lg">
            Vue d'ensemble des performances et de l'activité
          </p>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Utilisateurs Total"
          value={stats.total_users}
          icon={<Users size={24} />}
          color="blue"
          subtext={`${stats.new_registrations_today} aujourd'hui`}
        />
        <StatCard
          title="Parents"
          value={stats.total_parents}
          icon={<UserPlus size={24} />}
          color="green"
        />
        <StatCard
          title="Enfants"
          value={stats.total_children}
          icon={<UserPlus size={24} />}
          color="purple"
        />
        <StatCard
          title="Contenu Total"
          value={
            stats.total_courses + stats.total_exercises + stats.total_quizzes
          }
          icon={<BookOpen size={24} />}
          color="orange"
          subtext={`${stats.total_courses} cours, ${stats.total_quizzes} quiz`}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Registrations Chart */}
        <div className="bg-white p-6 rounded-[20px] shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-[var(--greek-blue)] mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-[var(--greek-gold)]" />
            Inscriptions (30 derniers jours)
          </h3>
          <div className="h-64 flex items-end justify-between gap-2">
            {charts.registrations.length > 0 ? (
              charts.registrations.map((item: any, index: number) => (
                <div
                  key={index}
                  className="flex flex-col items-center flex-1 group"
                >
                  <div
                    className="w-full bg-blue-100 hover:bg-[var(--greek-blue)] transition-all rounded-t-sm relative"
                    style={{ height: `${Math.max(item.count * 10, 5)}%` }} // Simple scaling
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded pointer-events-none">
                      {item.count}
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-2 transform -rotate-45 origin-top-left truncate w-full">
                    {new Date(item.date).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                Aucune donnée disponible
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-[20px] shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-[var(--greek-blue)] mb-6 flex items-center gap-2">
            <Activity size={20} className="text-[var(--greek-gold)]" />
            Activités Récentes
          </h3>
          <div className="space-y-4">
            {recent_activity.length > 0 ? (
              recent_activity.map((item: any, index: number) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="p-2 bg-blue-100 text-[var(--greek-blue)] rounded-full">
                    <UserPlus size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {item.description}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {item.type} •{" "}
                      {new Date(item.timestamp).toLocaleString("fr-FR")}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 italic">Aucune activité récente.</p>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Metrics Grid */}
      <div className="bg-white p-6 rounded-[20px] shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-[var(--greek-blue)] mb-6 flex items-center gap-2">
          <PieChart size={20} className="text-[var(--greek-gold)]" />
          Métriques Avancées
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricItem
            label="Taux de conversion"
            value={`${stats.conversion_rate || 0}%`}
            trend="neutral"
          />
          <MetricItem
            label="Durée moyenne session"
            value={`${stats.avg_session_duration || 0} min`}
            trend="neutral"
          />
          <MetricItem
            label="Taux de rebond"
            value={`${stats.bounce_rate || 0}%`}
            trend="neutral"
          />
          <MetricItem
            label="Rétention (7j)"
            value={`${stats.retention_rate_7d || 0}%`}
            trend="neutral"
          />
          <MetricItem
            label="Rétention (30j)"
            value={`${stats.retention_rate_30d || 0}%`}
            trend="neutral"
          />
          <MetricItem
            label="Taux de complétion"
            value={`${stats.completion_rate || 0}%`}
            trend="neutral"
          />
          <MetricItem
            label="Score moyen Quiz"
            value={`${stats.avg_quiz_score || 0}/20`}
            trend="neutral"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, subtext }: any) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <div className="bg-white p-6 rounded-[20px] shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="text-gray-500 text-xs font-bold uppercase tracking-wide">
            {title}
          </h4>
          <div className="text-3xl font-bold text-[var(--greek-blue)] mt-2">{value}</div>
        </div>
        <div className={`p-3 rounded-xl ${colors[color] || colors.blue}`}>
          {icon}
        </div>
      </div>
      {subtext && (
        <div className="text-xs text-gray-500 border-t border-gray-50 pt-3 mt-1">
          {subtext}
        </div>
      )}
    </div>
  );
}

function MetricItem({ label, value, trend }: any) {
  return (
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
      <div className="text-2xl font-bold text-[var(--greek-blue)]">{value}</div>
      <div className="text-xs text-gray-500 mt-1 uppercase font-semibold">{label}</div>
    </div>
  );
}
