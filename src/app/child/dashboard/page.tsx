"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { USER_SELECT_COLUMNS } from "@/lib/userColumns";
import {
  BookOpen, BrainCircuit, PenTool, Trophy, ArrowRight,
  Play, MessageSquare, Star, CheckCircle, Zap,
} from "lucide-react";
import AppAdminLoader from "@/components/AppAdminLoader";
import MiniCalendarWidget from "@/components/calendar/MiniCalendarWidget";

const ICON_MAP: Record<string, any> = {
  pencil: PenTool, zap: Zap, flame: Star, star: Star, crown: Trophy,
  check: CheckCircle, trophy: Trophy, brain: BrainCircuit, sparkles: Star,
  graduation: Star, book: BookOpen, map: Star, library: BookOpen,
  sword: Star, swords: Star, medal: Trophy, gem: Star, crystal: Star,
  divine: Star, shield: CheckCircle, bullseye: Star, bookmark: BookOpen,
  scroll: BookOpen, owl: Star, universe: Star,
};

export default function ChildDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [authId, setAuthId] = useState<string | null>(null);
  const [gradeLevel, setGradeLevel] = useState<string | null>(null);
  const [nextCourse, setNextCourse] = useState<any>(null);
  const [nextExercise, setNextExercise] = useState<any>(null);
  const [earnedBadges, setEarnedBadges] = useState<any[]>([]);
  const [stats, setStats] = useState({ badges: 0, exercises: 0 });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/auth/connexion"); return; }

      const { data: userData }: any = await supabase.from("users").select(USER_SELECT_COLUMNS).eq("auth_id", session.user.id).maybeSingle();
      if (!userData || userData.role !== "child") { router.push("/dashboard"); return; }

      setUser(userData);
      setAuthId(session.user.id);
      setGradeLevel(userData.grade_level);

      const level = userData.grade_level;

      // Fetch in parallel
      const [
        { data: courses },
        { data: exercises },
        { data: progress },
        { data: attempts },
        { data: ubadges },
        { count: exoCount },
      ] = await Promise.all([
        supabase.from("courses").select("id, title, subject, level").eq("status", "published").eq("level", level).limit(10),
        supabase.from("exercises").select("id, title, difficulty_level").eq("status", "published").limit(10),
        supabase.from("user_course_progress").select("course_id").eq("user_id", userData.id),
        supabase.from("user_exercise_attempts").select("exercise_id").eq("user_id", userData.id),
        supabase.from("user_badges").select("badge:badges(id, name, icon, color)").eq("user_id", userData.id).order("earned_at", { ascending: false }).limit(4),
        supabase.from("user_exercise_attempts").select("*", { count: "exact", head: true }).eq("user_id", userData.id),
      ]);

      // Next course = first not yet started
      const doneCoursesIds = new Set((progress || []).map((p: any) => p.course_id));
      const nextC = (courses || []).find((c: any) => !doneCoursesIds.has(c.id));
      setNextCourse(nextC || (courses || [])[0] || null);

      // Next exercise = first not yet attempted
      const doneExoIds = new Set((attempts || []).map((a: any) => a.exercise_id));
      const nextE = (exercises || []).find((e: any) => !doneExoIds.has(e.id));
      setNextExercise(nextE || (exercises || [])[0] || null);

      // Badges
      const badges = (ubadges || []).map((ub: any) => ub.badge).filter(Boolean);
      setEarnedBadges(badges);
      setStats({ badges: badges.length, exercises: exoCount ?? 0 });
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[var(--greek-cream)]"><AppAdminLoader /></div>;

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-12">
      {/* Header */}
      <div className="bg-[var(--greek-blue)] text-white pt-24 pb-12 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-5xl font-bold mb-2">
                Bonjour, {user?.first_name} !
              </h1>
              <p className="text-xl opacity-90 flex items-center gap-2">
                <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-3 py-1 rounded-full">{gradeLevel || "Niveau"}</span>
                <span>Prêt à apprendre ?</span>
              </p>
            </div>
            <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-[rgba(197,161,72,0.25)]">
              <div className="text-center px-4 border-r border-[rgba(197,161,72,0.25)]">
                <div className="text-2xl font-bold text-[var(--greek-gold)]">{stats.badges}</div>
                <div className="text-xs uppercase tracking-wider opacity-80">Badges</div>
              </div>
              <div className="text-center px-4">
                <div className="text-2xl font-bold text-[var(--greek-gold)]">{stats.exercises}</div>
                <div className="text-xs uppercase tracking-wider opacity-80">Exercices</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4">
        {/* Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {[
            { href: "/child/cours", icon: BookOpen, label: "Mes Cours", desc: "Découvre de nouvelles leçons", color: "bg-blue-100 text-[var(--greek-blue)]", action: "Commencer" },
            { href: "/child/exercises", icon: PenTool, label: "Exercices", desc: "Entraîne-toi et progresse", color: "bg-orange-100 text-[var(--greek-bronze)]", action: "S'entraîner" },
            { href: "/child/quiz", icon: BrainCircuit, label: "Quiz", desc: "Teste tes connaissances", color: "bg-yellow-100 text-[var(--greek-gold)]", action: "Jouer" },
            { href: "/child/forum", icon: MessageSquare, label: "Forum", desc: "Pose tes questions", color: "bg-blue-100 text-[var(--greek-blue)]", action: "Y aller" },
          ].map(({ href, icon: Icon, label, desc, color, action }) => (
            <Link key={href} href={href} className="group">
              <div className="bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Icon className="w-24 h-24" />
                </div>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 ${color}`}>
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-2">{label}</h3>
                <p className="text-gray-600 mb-4 text-sm">{desc}</p>
                <div className="flex items-center text-[var(--greek-blue)] font-bold group-hover:gap-2 transition-all text-sm">
                  {action} <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* À faire ensuite — données réelles */}
        <div className="bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)] mb-8">
          <div className="flex items-center gap-3 mb-5">
            <Star className="w-5 h-5 text-[var(--greek-gold)] fill-current" />
            <h2 className="text-xl font-bold text-[var(--greek-blue)]">À faire ensuite</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Prochain cours */}
            {nextCourse ? (
              <div className="bg-blue-50 rounded-2xl p-5 border border-[rgba(197,161,72,0.25)] flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[var(--greek-blue)] rounded-xl flex items-center justify-center text-white shrink-0">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Cours</p>
                    <h4 className="font-bold text-gray-800 text-sm line-clamp-1">{nextCourse.title}</h4>
                    <p className="text-xs text-gray-500">{nextCourse.subject}</p>
                  </div>
                </div>
                <Link href={`/child/cours/${nextCourse.id}`} className="btn-primary-greek px-4 py-2 text-sm whitespace-nowrap flex items-center gap-1">
                  <Play className="w-3 h-3 fill-current" /> Démarrer
                </Link>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-2xl p-5 border border-[rgba(197,161,72,0.25)] flex items-center gap-3 text-gray-400">
                <BookOpen className="w-6 h-6" />
                <span className="text-sm">Aucun cours disponible pour ton niveau.</span>
              </div>
            )}

            {/* Prochain exercice */}
            {nextExercise ? (
              <div className="bg-orange-50 rounded-2xl p-5 border border-[rgba(197,161,72,0.25)] flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[var(--greek-bronze)] rounded-xl flex items-center justify-center text-white shrink-0">
                    <PenTool className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Exercice</p>
                    <h4 className="font-bold text-gray-800 text-sm line-clamp-1">{nextExercise.title}</h4>
                    <p className="text-xs text-gray-500 capitalize">{nextExercise.difficulty_level || "Normal"}</p>
                  </div>
                </div>
                <Link href={`/child/exercises/${nextExercise.id}`} className="bg-[var(--greek-bronze)] text-white px-4 py-2 text-sm rounded-lg font-bold hover:bg-[var(--greek-gold)] transition-colors whitespace-nowrap flex items-center gap-1">
                  <Play className="w-3 h-3 fill-current" /> Faire
                </Link>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-2xl p-5 border border-[rgba(197,161,72,0.25)] flex items-center gap-3 text-gray-400">
                <PenTool className="w-6 h-6" />
                <span className="text-sm">Tous les exercices ont été faits !</span>
              </div>
            )}
          </div>
        </div>

        {/* Calendrier */}
        {authId && user && (
          <div className="mb-8">
            <MiniCalendarWidget authId={authId} ownerId={user.id} isParent={false} title="Mon Calendrier" fullCalendarHref="/child/calendar" />
          </div>
        )}

        {/* Mes Trophées — réels */}
        <div className="bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)]">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-[var(--greek-bronze)]" />
              <h2 className="text-xl font-bold text-[var(--greek-blue)]">Mes Trophées</h2>
            </div>
            <Link href="/child/badges" className="text-sm text-[var(--greek-blue)] font-bold hover:underline">
              Voir tout
            </Link>
          </div>

          {earnedBadges.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Trophy className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Complète des exercices pour gagner tes premiers badges !</p>
              <Link href="/child/badges" className="mt-3 inline-block text-sm text-[var(--greek-blue)] font-bold hover:underline">
                Voir les objectifs
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {earnedBadges.map((b: any) => {
                const Icon = ICON_MAP[b.icon] || Star;
                return (
                  <div key={b.id} className="rounded-2xl border border-[rgba(197,161,72,0.25)] p-4 flex flex-col items-center text-center shadow-sm"
                    style={{ backgroundColor: b.color + "10" }}>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-2" style={{ backgroundColor: b.color + "20" }}>
                      <Icon className="w-6 h-6" style={{ color: b.color }} />
                    </div>
                    <span className="text-xs font-bold text-gray-700 line-clamp-2">{b.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


