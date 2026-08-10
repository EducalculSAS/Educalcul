import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  Users, BookOpen, CheckCircle, TrendingUp,
  ArrowRight, Plus, MessageSquare, Crown, UserCircle,
  BarChart2,
} from "lucide-react";
import MiniCalendarWidget from "@/components/calendar/MiniCalendarWidget";
import ChildReportLink from "@/components/parent/ChildReportLink";
import { avatarUrl } from "@/lib/avatarUrl";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import GlassButton from "@/components/ui/GlassButton";

interface ChildStats {
  exerciseCount: number;
  quizCount: number;
  successRate: number;
  lastActivity: { type: string; title: string; relativeTime: string } | null;
}

interface ChildRow {
  id: string;
  first_name: string;
  last_name: string;
  grade_level: string | null;
  avatar?: string;
}

const formatRelativeTime = (d: string) => {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return `Il y a ${Math.floor(diff / 86400)} j`;
};

async function fetchChildStats(childId: string): Promise<ChildStats> {
  const [
    { count: totalEx },
    { count: totalQuiz },
    { data: correct },
    { data: lastQuiz },
    { data: lastEx },
  ] = await Promise.all([
    supabaseAdmin.from("user_exercise_attempts").select("*", { count: "exact", head: true }).eq("user_id", childId),
    supabaseAdmin.from("user_quiz_attempts").select("*", { count: "exact", head: true }).eq("user_id", childId),
    supabaseAdmin.from("user_exercise_attempts").select("id").eq("user_id", childId).eq("is_correct", true),
    supabaseAdmin.from("user_quiz_attempts").select("completed_at, score, total_questions, quizzes(title)").eq("user_id", childId).order("completed_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("user_exercise_attempts").select("attempted_at, is_correct, exercises(title)").eq("user_id", childId).order("attempted_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const successRate = (totalEx || 0) > 0 ? Math.round(((correct?.length || 0) / (totalEx || 1)) * 100) : 0;

  const activities: { type: string; title: string; date: string }[] = [];
  if (lastQuiz) activities.push({ type: "Quiz", title: (lastQuiz as any).quizzes?.title || "Quiz", date: (lastQuiz as any).completed_at });
  if (lastEx) activities.push({ type: "Exercice", title: (lastEx as any).exercises?.title || "Exercice", date: (lastEx as any).attempted_at });
  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    exerciseCount: totalEx || 0,
    quizCount: totalQuiz || 0,
    successRate,
    lastActivity: activities[0] ? { ...activities[0], relativeTime: formatRelativeTime(activities[0].date) } : null,
  };
}

// Toute la page est un affichage de données propres au parent connecté (ses
// enfants + leurs stats) : la seule chose qui dépend d'un état vraiment
// interactif est le verrou "rapport détaillé" selon le plan d'abonnement,
// isolé dans ChildReportLink. Le reste (y compris les stats par enfant, avant
// chargées une par une après le montage) se résout entièrement côté serveur.
export default async function ParentDashboard() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "parent") redirect("/dashboard");

  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("first_name, role, id")
    .eq("id", authUser.id)
    .maybeSingle();
  if (!userData) redirect("/dashboard");

  const { data: childrenRows } = await supabaseAdmin
    .from("users")
    .select("id, first_name, last_name, grade_level, avatar")
    .eq("role", "child")
    .eq("parent_id", userData.id)
    .order("first_name");

  const childrenBase = (childrenRows || []) as ChildRow[];
  const stats = await Promise.all(childrenBase.map((c) => fetchChildStats(c.id)));
  const children = childrenBase.map((c, i) => ({ ...c, stats: stats[i] }));

  const totalExercises = children.reduce((a, c) => a + (c.stats?.exerciseCount || 0), 0);

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-12">
      {/* Hero Header — même style que child */}
      <div className="bg-[var(--greek-blue)] text-white pt-24 pb-12 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-2">
                Bonjour, {userData.first_name || "Parent"} !
              </h1>
              <p className="text-xl opacity-90 flex items-center gap-2">
                <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-3 py-1 rounded-full">PARENT</span>
                <span>Suivez les progrès de vos enfants.</span>
              </p>
            </div>
            <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-[rgba(197,161,72,0.25)]">
              <div className="text-center px-4 border-r border-[rgba(197,161,72,0.25)]">
                <div className="text-2xl font-bold text-[var(--greek-gold)]">{children.length}</div>
                <div className="text-xs uppercase tracking-wider opacity-80">Enfant{children.length !== 1 ? "s" : ""}</div>
              </div>
              <div className="text-center px-4">
                <div className="text-2xl font-bold text-[var(--greek-gold)]">{totalExercises}</div>
                <div className="text-xs uppercase tracking-wider opacity-80">Exercices</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4">
        {/* Navigation rapide — même style que child */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <Link href="/parent/children" className="group">
            <div className="bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Users className="w-24 h-24 text-[var(--greek-blue)]" />
              </div>
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 text-[var(--greek-blue)] group-hover:scale-110 transition-transform duration-300">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2">Mes Enfants</h3>
              <p className="text-gray-600 mb-4 text-sm">Gérez les comptes et suivez la progression.</p>
              <div className="flex items-center text-[var(--greek-blue)] font-bold group-hover:gap-2 transition-all">
                Gérer <ArrowRight className="w-5 h-5 ml-1" />
              </div>
            </div>
          </Link>

          <Link href="/parent/forum" className="group">
            <div className="bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <MessageSquare className="w-24 h-24 text-[var(--greek-bronze)]" />
              </div>
              <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mb-4 text-[var(--greek-bronze)] group-hover:scale-110 transition-transform duration-300">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2">Le Forum</h3>
              <p className="text-gray-600 mb-4 text-sm">Échangez avec d'autres parents et l'équipe.</p>
              <div className="flex items-center text-[var(--greek-bronze)] font-bold group-hover:gap-2 transition-all">
                Participer <ArrowRight className="w-5 h-5 ml-1" />
              </div>
            </div>
          </Link>

          <Link href="/parent/subscription" className="group">
            <div className="bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Crown className="w-24 h-24 text-[var(--greek-gold)]" />
              </div>
              <div className="w-14 h-14 bg-yellow-100 rounded-2xl flex items-center justify-center mb-4 text-[var(--greek-gold)] group-hover:scale-110 transition-transform duration-300">
                <Crown className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2">Abonnement</h3>
              <p className="text-gray-600 mb-4 text-sm">Gérez votre formule et votre parrainage.</p>
              <div className="flex items-center text-[var(--greek-gold)] font-bold group-hover:gap-2 transition-all">
                Voir <ArrowRight className="w-5 h-5 ml-1" />
              </div>
            </div>
          </Link>

          <Link href="/parent/profile" className="group">
            <div className="bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <UserCircle className="w-24 h-24 text-[var(--greek-blue)]" />
              </div>
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 text-[var(--greek-blue)] group-hover:scale-110 transition-transform duration-300">
                <UserCircle className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2">Mon Profil</h3>
              <p className="text-gray-600 mb-4 text-sm">Modifiez vos informations et votre photo.</p>
              <div className="flex items-center text-[var(--greek-blue)] font-bold group-hover:gap-2 transition-all">
                Modifier <ArrowRight className="w-5 h-5 ml-1" />
              </div>
            </div>
          </Link>
        </div>

        {/* Section enfants */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] flex items-center gap-3">
            <BarChart2 className="w-6 h-6 text-[var(--greek-gold)]" />
            Suivi de mes enfants
          </h2>
          <GlassButton href="/parent/add-child" variant="navy" size="sm">
            <Plus className="w-4 h-4" /> Ajouter un enfant
          </GlassButton>
        </div>

        {children.length === 0 ? (
          <div className="bg-white rounded-[20px] p-10 shadow-sm border border-[rgba(197,161,72,0.25)] text-center">
            <Users className="w-16 h-16 text-[var(--greek-blue)] opacity-20 mx-auto mb-4" />
            <p className="text-xl text-[var(--greek-blue)] font-bold font-[family-name:var(--font-display)] mb-2">Aucun enfant ajouté</p>
            <p className="text-gray-500 mb-6">Ajoutez votre premier enfant pour commencer le suivi.</p>
            <GlassButton href="/parent/add-child" variant="navy">
              Commencer maintenant
            </GlassButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {children.map((child) => {
              const avatar = avatarUrl(child.avatar, "/avatars/avatar1.png");
              return (
                <div key={child.id} className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group">
                  {/* Header */}
                  <div className="p-5 border-b border-[rgba(197,161,72,0.25)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative w-11 h-11 rounded-2xl bg-[var(--greek-blue)]/10 flex items-center justify-center overflow-hidden font-bold text-[var(--greek-blue)] group-hover:scale-110 transition-transform duration-300">
                          {child.avatar && avatar
                            ? <Image src={avatar} alt={child.first_name} fill sizes="44px" className="object-cover" />
                            : <span className="text-lg">{child.first_name.charAt(0)}</span>}
                        </div>
                        <div>
                          <h3 className="font-bold text-[var(--greek-blue)] text-lg leading-tight">{child.first_name} {child.last_name}</h3>
                          <span className="inline-block text-xs font-semibold bg-[var(--greek-blue)]/10 text-[var(--greek-blue)] px-2 py-0.5 rounded-full">{child.grade_level || "Niveau non défini"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 flex-grow">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-gray-50 rounded-xl border border-[rgba(197,161,72,0.25)] text-center">
                          <CheckCircle className="w-4 h-4 text-green-500 mx-auto mb-1" />
                          <div className="text-lg font-bold text-gray-800">{child.stats?.exerciseCount || 0}</div>
                          <div className="text-xs text-gray-500">Exercices</div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-xl border border-[rgba(197,161,72,0.25)] text-center">
                          <TrendingUp className="w-4 h-4 text-[var(--greek-gold)] mx-auto mb-1" />
                          <div className="text-lg font-bold text-gray-800">{child.stats?.successRate || 0}%</div>
                          <div className="text-xs text-gray-500">Réussite</div>
                        </div>
                      </div>
                      {child.stats?.lastActivity && (
                        <div className="pt-3 border-t border-[rgba(197,161,72,0.25)]">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Dernière activité</p>
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${child.stats.lastActivity.type === "Quiz" ? "bg-purple-100 text-purple-600" : "bg-green-100 text-green-600"}`}>
                              {child.stats.lastActivity.type === "Quiz" ? <CheckCircle className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{child.stats.lastActivity.title}</p>
                              <p className="text-xs text-gray-400">{child.stats.lastActivity.relativeTime}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-4 bg-gray-50 border-t border-[rgba(197,161,72,0.25)]">
                    <ChildReportLink childId={child.id} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Calendrier */}
        <div className="mt-8">
          <MiniCalendarWidget authId={authUser.authId} ownerId={userData.id} isParent={true} title="Calendrier" fullCalendarHref="/parent/calendar" />
        </div>
      </div>
    </div>
  );
}
