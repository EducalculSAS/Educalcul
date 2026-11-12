"use client";

import Emblem3D, { type EmblemKind } from "@/components/Emblem3D";
import type { fetchAdminStats } from "@/lib/adminStats";

type AdminStatsData = Awaited<ReturnType<typeof fetchAdminStats>>;
import AvatarWithBorder from "@/components/AvatarWithBorder";
import { useState, useCallback } from "react";
import { Users, CreditCard, BookOpen, Calculator, Brain, MessageSquare, TicketCheck, BarChart2, Shield, RefreshCw, ChevronRight, Clock, Keyboard, Gamepad2, Mail, Scale, GraduationCap, Calendar, Star, History, ScanSearch, ShieldCheck, Flag, User } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import GlassButton from "@/components/ui/GlassButton";
import { formatParisDayMonth } from "@/lib/parisDate";

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

/** Tableau de bord admin : les stats initiales arrivent déjà chargées du
 * serveur ; le bouton "Actualiser" reste un aller-retour client, comme
 * avant. */
export default function AdminDashboardClient({ initialData }: { initialData: AdminStatsData }) {
  const [data, setData] = useState<AdminStatsData>(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/stats?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        setData(await res.json());
        setLastUpdated(new Date());
        setLoadError(null);
      } else if (res.status === 401) {
        setLoadError("Session expirée, redirection…");
      } else {
        setLoadError(`Erreur serveur (${res.status}).`);
      }
    } catch {
      setLoadError("Impossible de contacter le serveur.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  if (!data) return <div className="p-6 text-red-500">{loadError || "Erreur de chargement."}</div>;

  const { counts, recent } = data;

  return (
    <div className="space-y-6">

      <AdminPageHeader
        icon={Shield}
        title="Tableau de bord"
        subtitle="Vue d'ensemble de la plateforme"
        actions={
          <>
            {lastUpdated && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock size={12} />
                {lastUpdated.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
            <GlassButton
              onClick={() => load()}
              disabled={refreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Actualiser</span>
            </GlassButton>
          </>
        }
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Utilisateurs" value={counts.users} sub={`+${counts.new_users_week} cette semaine`} icon="family" href="/admin/users" />
        <StatCard title="Abonnements actifs" value={counts.active_subscriptions} icon="card" href="/admin/subscriptions" />
        <StatCard title="Cours" value={counts.published_courses} icon="book" href="/admin/courses" />
        <StatCard title="Exercices" value={counts.exercises} icon="calculator" href="/admin/exercises" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Quiz" value={counts.quizzes} icon="quiz" href="/admin/quizzes" />
        <StatCard title="Tickets ouverts" value={counts.open_tickets} icon="inbox" href="/admin/support" alert={counts.open_tickets > 0} />
        <StatCard title="Signalements" value={counts.pending_reports} icon="alert" href="/admin/forum" alert={counts.pending_reports > 0} />
        <StatCard title="Rapports" value="→" icon="target" href="/admin/reports" />
      </div>

      {/* Recent data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent users */}
        <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-[var(--greek-blue)] flex items-center gap-2">
              <Emblem3D kind="family" size={28} float={false} />
              Derniers inscrits
            </h2>
            <GlassButton href="/admin/users" variant="outline" size="sm">
              Voir tout <ChevronRight size={12} />
            </GlassButton>
          </div>
          <div className="divide-y divide-gray-50">
            {recent.users.length === 0 && (
              <p className="text-gray-400 text-sm italic p-6 text-center">Aucun utilisateur.</p>
            )}
            {recent.users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors">
                <AvatarWithBorder avatar={u.avatar} equippedBorder={u.equipped_border} name={`${u.first_name ?? ""} ${u.last_name ?? ""}`} size="sm" label="" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {u.first_name} {u.last_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatParisDayMonth(u.created_at, { time: true })}
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
              <Emblem3D kind="book" size={28} float={false} />
              Cours récents
            </h2>
            <GlassButton href="/admin/courses" variant="outline" size="sm">
              Gérer <ChevronRight size={12} />
            </GlassButton>
          </div>
          <div className="divide-y divide-gray-50">
            {recent.courses.length === 0 && (
              <p className="text-gray-400 text-sm italic p-6 text-center">Aucun cours.</p>
            )}
            {recent.courses.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors">
                <Emblem3D kind="book" size={34} float={false} className="shrink-0" />
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
              <Emblem3D kind="chat" size={28} float={false} />
              Forum, posts récents
            </h2>
            <GlassButton href="/admin/forum" variant="outline" size="sm">
              Modérer <ChevronRight size={12} />
            </GlassButton>
          </div>
          <div className="divide-y divide-gray-50">
            {recent.forum_posts.length === 0 && (
              <p className="text-gray-400 text-sm italic p-6 text-center">Aucun post.</p>
            )}
            {recent.forum_posts.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors">
                <Emblem3D kind="chat" size={34} float={false} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.title}</p>
                  <p className="text-xs text-gray-400">
                    {p.author?.first_name ?? "?"} {p.author?.last_name ?? ""} ·{" "}
                    {formatParisDayMonth(p.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-6">
          <h2 className="font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
            <Emblem3D kind="compass" size={28} float={false} />
            Accès rapide
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { href: "/admin/users",         icon: <Users size={15} />,         label: "Utilisateurs"   },
              { href: "/admin/courses",       icon: <BookOpen size={15} />,      label: "Cours"          },
              { href: "/admin/exercises",     icon: <Calculator size={15} />,    label: "Exercices"      },
              { href: "/admin/quizzes",       icon: <Brain size={15} />,         label: "Quiz"           },
              { href: "/admin/clavier",       icon: <Keyboard size={15} />,      label: "Clavier"        },
              { href: "/admin/minigames",     icon: <Gamepad2 size={15} />,      label: "Mini-jeux"      },
              { href: "/admin/reports",       icon: <BarChart2 size={15} />,     label: "Rapports"       },
              { href: "/admin/forum",         icon: <MessageSquare size={15} />, label: "Forum"          },
              { href: "/admin/emails",        icon: <Mail size={15} />,          label: "Emails"         },
              { href: "/admin/support",       icon: <TicketCheck size={15} />,   label: "Support"        },
              { href: "/admin/subscriptions", icon: <CreditCard size={15} />,    label: "Abonnements"    },
              { href: "/admin/juridique",     icon: <Scale size={15} />,         label: "Juridique"      },
              { href: "/admin/programmes",    icon: <GraduationCap size={15} />, label: "Programmes"     },
              { href: "/admin/calendar",      icon: <Calendar size={15} />,      label: "Calendrier"     },
              { href: "/admin/reviews",       icon: <Star size={15} />,          label: "Avis clients"   },
              { href: "/admin/audit-log",     icon: <History size={15} />,       label: "Journal d'audit"},
              { href: "/admin/scanner",       icon: <ScanSearch size={15} />,    label: "Scanner IA"     },
              { href: "/admin/security",      icon: <ShieldCheck size={15} />,   label: "Sécurité"       },
              { href: "/admin/feature-flags", icon: <Flag size={15} />,          label: "Fonctionnalités"},
              { href: "/admin/profile",       icon: <User size={15} />,          label: "Profil"         },
            ].map(({ href, icon, label }) => (
              <GlassButton key={href} href={href} variant="ghost" fullWidth>
                {icon} {label}
              </GlassButton>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ title, value, sub, icon, href, alert }: {
  title: string; value: number | string; sub?: string;
  icon: EmblemKind; href: string; alert?: boolean;
}) {
  return (
    <GlassButton
      href={href}
      variant={alert ? "danger" : "outline"}
      rounded="xl"
      fullWidth
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "20px", gap: 0 }}
    >
      <div className="flex items-center justify-between w-full mb-3">
        <Emblem3D kind={icon} size={40} float={false} />
        <span className="text-2xl font-bold text-[var(--greek-blue)]">{value}</span>
      </div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </GlassButton>
  );
}
