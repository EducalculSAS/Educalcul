"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import PageLoader from "@/components/PageLoader";
import {
  Users, CreditCard, BookOpen, Calculator, Brain,
  MessageSquare, TicketCheck, AlertTriangle, TrendingUp,
  UserPlus, BarChart2, Settings, Shield, Gift, RefreshCw,
  ChevronRight, Clock,
} from "lucide-react";
import { avatarUrl } from "@/lib/avatarUrl";

const ROLE_LABEL: Record<string, string> = { parent: "Parent", child: "Élève", admin: "Admin" };
const ROLE_COLOR: Record<string, string> = {
  parent: "bg-blue-100 text-blue-700",
  child:  "bg-green-100 text-green-700",
  admin:  "bg-red-100 text-red-700",
};
const STATUS_COLOR: Record<string, string> = {
  published: "bg-green-100 text-green-700",
  draft:     "bg-gray-100 text-gray-500",
};

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/stats?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) { setData(await res.json()); setLastUpdated(new Date()); }
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageLoader />;
  if (!data) return <div className="p-6 text-red-500">Erreur de chargement.</div>;

  const { counts, recent } = data;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] flex items-center gap-3">
            <Shield className="text-[var(--greek-gold)]" size={30} />
            Tableau de bord
          </h1>
          <p className="text-[var(--greek-bronze)] mt-0.5">
            Vue d'ensemble de la plateforme
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock size={12} />
              {lastUpdated.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>
      </div>

      {/* Alerts row */}
      {(counts.open_tickets > 0 || counts.pending_reports > 0) && (
        <div className="flex flex-wrap gap-3">
          {counts.open_tickets > 0 && (
            <Link href="/admin/support" className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors">
              <TicketCheck size={16} />
              {counts.open_tickets} ticket{counts.open_tickets > 1 ? "s" : ""} ouvert{counts.open_tickets > 1 ? "s" : ""}
              <ChevronRight size={14} />
            </Link>
          )}
          {counts.pending_reports > 0 && (
            <Link href="/admin/forum" className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors">
              <AlertTriangle size={16} />
              {counts.pending_reports} signalement{counts.pending_reports > 1 ? "s" : ""} forum
              <ChevronRight size={14} />
            </Link>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Utilisateurs" value={counts.users} sub={`+${counts.new_users_week} cette semaine`} icon={<Users size={20} />} color="bg-blue-50 text-blue-600" href="/admin/users" />
        <StatCard title="Abonnements actifs" value={counts.active_subscriptions} icon={<CreditCard size={20} />} color="bg-green-50 text-green-600" href="/admin/subscriptions" />
        <StatCard title="Cours publiés" value={counts.published_courses} icon={<BookOpen size={20} />} color="bg-orange-50 text-orange-600" href="/admin/courses" />
        <StatCard title="Exercices" value={counts.exercises} icon={<Calculator size={20} />} color="bg-purple-50 text-purple-600" href="/admin/exercises" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Quiz" value={counts.quizzes} icon={<Brain size={20} />} color="bg-pink-50 text-pink-600" href="/admin/quizzes" />
        <StatCard title="Tickets ouverts" value={counts.open_tickets} icon={<TicketCheck size={20} />} color="bg-amber-50 text-amber-600" href="/admin/support" alert={counts.open_tickets > 0} />
        <StatCard title="Signalements" value={counts.pending_reports} icon={<AlertTriangle size={20} />} color="bg-red-50 text-red-600" href="/admin/forum" alert={counts.pending_reports > 0} />
        <StatCard title="Rapports" value="→" icon={<BarChart2 size={20} />} color="bg-teal-50 text-teal-600" href="/admin/reports" />
      </div>

      {/* Recent data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent users */}
        <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-[var(--greek-blue)] flex items-center gap-2">
              <UserPlus size={17} className="text-[var(--greek-gold)]" />
              Derniers inscrits
            </h2>
            <Link href="/admin/users" className="text-xs text-[var(--greek-blue)] hover:underline flex items-center gap-1">
              Voir tout <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recent.users.length === 0 && (
              <p className="text-gray-400 text-sm italic p-6 text-center">Aucun utilisateur.</p>
            )}
            {recent.users.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors">
                <img
                  src={avatarUrl(u.avatar, "/avatars/avatar1.png")!}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover border border-gray-200"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {u.first_name} {u.last_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(u.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLOR[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                  {ROLE_LABEL[u.role] ?? u.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent courses */}
        <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-[var(--greek-blue)] flex items-center gap-2">
              <BookOpen size={17} className="text-[var(--greek-gold)]" />
              Cours récents
            </h2>
            <Link href="/admin/courses" className="text-xs text-[var(--greek-blue)] hover:underline flex items-center gap-1">
              Gérer <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recent.courses.length === 0 && (
              <p className="text-gray-400 text-sm italic p-6 text-center">Aucun cours.</p>
            )}
            {recent.courses.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                  <BookOpen size={14} className="text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{c.title}</p>
                  <p className="text-xs text-gray-400">{c.subject} · {c.level}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[c.status] ?? "bg-gray-100 text-gray-500"}`}>
                  {c.status === "published" ? "Publié" : "Brouillon"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent forum posts */}
        <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-[var(--greek-blue)] flex items-center gap-2">
              <MessageSquare size={17} className="text-[var(--greek-gold)]" />
              Forum — posts récents
            </h2>
            <Link href="/admin/forum" className="text-xs text-[var(--greek-blue)] hover:underline flex items-center gap-1">
              Modérer <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recent.forum_posts.length === 0 && (
              <p className="text-gray-400 text-sm italic p-6 text-center">Aucun post.</p>
            )}
            {recent.forum_posts.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                  <MessageSquare size={14} className="text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.title}</p>
                  <p className="text-xs text-gray-400">
                    {p.author?.first_name ?? "?"} {p.author?.last_name ?? ""} ·{" "}
                    {new Date(p.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-6">
          <h2 className="font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
            <TrendingUp size={17} className="text-[var(--greek-gold)]" />
            Accès rapide
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/admin/users",         icon: <Users size={15} />,          label: "Utilisateurs",    color: "hover:bg-blue-50 hover:text-blue-700"   },
              { href: "/admin/subscriptions", icon: <CreditCard size={15} />,     label: "Abonnements",     color: "hover:bg-green-50 hover:text-green-700"  },
              { href: "/admin/courses",        icon: <BookOpen size={15} />,       label: "Cours",           color: "hover:bg-orange-50 hover:text-orange-700"},
              { href: "/admin/exercises",      icon: <Calculator size={15} />,     label: "Exercices",       color: "hover:bg-purple-50 hover:text-purple-700"},
              { href: "/admin/quizzes",        icon: <Brain size={15} />,          label: "Quiz",            color: "hover:bg-pink-50 hover:text-pink-700"    },
              { href: "/admin/forum",          icon: <MessageSquare size={15} />,  label: "Forum",           color: "hover:bg-indigo-50 hover:text-indigo-700"},
              { href: "/admin/support",        icon: <TicketCheck size={15} />,    label: "Support",         color: "hover:bg-amber-50 hover:text-amber-700"  },
              { href: "/admin/reports",        icon: <BarChart2 size={15} />,      label: "Rapports",        color: "hover:bg-teal-50 hover:text-teal-700"    },
              { href: "/admin/landing",         icon: <Gift size={15} />,           label: "Landing Page",    color: "hover:bg-rose-50 hover:text-rose-700"   },
              { href: "/admin/settings",       icon: <Settings size={15} />,       label: "Paramètres",      color: "hover:bg-gray-50 hover:text-gray-700"    },
            ].map(({ href, icon, label, color }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-100 text-sm font-semibold text-gray-600 transition-colors ${color}`}
              >
                {icon} {label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ title, value, sub, icon, color, href, alert }: {
  title: string; value: number | string; sub?: string;
  icon: React.ReactNode; color: string; href: string; alert?: boolean;
}) {
  return (
    <Link href={href} className="block group">
      <div className={`bg-white p-5 rounded-2xl shadow-sm border transition-shadow group-hover:shadow-md ${alert ? "border-red-200" : "border-gray-100"}`}>
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-xl ${color}`}>{icon}</div>
          <span className="text-2xl font-bold text-[var(--greek-blue)]">{value}</span>
        </div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </Link>
  );
}
