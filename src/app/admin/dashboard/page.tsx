"use client";

import { useEffect, useState } from "react";
import { Users, CreditCard, BookOpen, Calculator, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    subscriptions: 0,
    courses: 0,
    exercises: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/stats');
        if (res.ok) {
          const data = await res.json();
          setStats({
            users: data.users || 0,
            subscriptions: data.active_subscriptions || 0,
            courses: data.published_courses || 0,
            exercises: data.exercises || 0,
          });
        } else {
          throw new Error('Failed to fetch stats');
        }
      } catch (err: any) {
        console.error("Error fetching stats:", err);
        setError("Impossible de charger certaines statistiques.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[var(--greek-gold)]/30 p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pattern-grid-lg pointer-events-none"></div>
        <h1 className="text-3xl font-bold text-[var(--greek-blue)] mb-2 font-[family-name:var(--font-display)]">
          Tableau de Bord Administrateur
        </h1>
        <p className="text-[var(--greek-bronze)] text-lg">
          Bienvenue dans l'espace de gestion EduCalcul
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2 border border-red-200">
          <AlertTriangle size={20} />
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Utilisateurs"
          value={stats.users}
          icon={Users}
          color="blue"
          href="/admin/users"
        />
        <StatCard
          title="Abonnements Actifs"
          value={stats.subscriptions}
          icon={CreditCard}
          color="green"
          href="/admin/users" // Could be subscriptions page later
        />
        <StatCard
          title="Cours Publiés"
          value={stats.courses}
          icon={BookOpen}
          color="amber"
          href="/admin/courses"
        />
        <StatCard
          title="Exercices"
          value={stats.exercises}
          icon={Calculator}
          color="purple"
          href="/admin/exercises"
        />
      </div>

      {/* Quick Actions / Recent Activity Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> Cours Récents
          </h2>
          <div className="text-gray-500 italic text-center py-8">
            Fonctionnalité à venir...
          </div>
        </div>

        <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" /> Derniers Inscrits
          </h2>
          <div className="text-gray-500 italic text-center py-8">
            Fonctionnalité à venir...
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, href }: any) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-green-50 text-green-600 border-green-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
  };

  return (
    <Link href={href} className="block group">
      <div className="bg-white rounded-[20px] p-6 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-xl ${colorClasses[color as keyof typeof colorClasses]}`}>
            <Icon size={24} />
          </div>
          <span className="text-3xl font-bold text-gray-800 font-[family-name:var(--font-display)]">
            {value}
          </span>
        </div>
        <h3 className="text-gray-500 font-medium">{title}</h3>
      </div>
    </Link>
  );
}
