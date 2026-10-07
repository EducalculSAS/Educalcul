import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getServerUser } from "@/lib/supabase/server";
import { USER_SELECT_COLUMNS } from "@/lib/userColumns";
import { getCatalogLevelLabel } from "@/lib/constants";
import {
  BookOpen, BrainCircuit, PenTool, Trophy, ArrowRight,
  Play, MessageSquare, Star, Compass, GraduationCap, CheckCircle, Zap, Gamepad2, type LucideIcon,
} from "lucide-react";
import MiniCalendarWidget from "@/components/calendar/MiniCalendarWidget";
import GlassButton from "@/components/ui/GlassButton";
import GoalCard from "@/components/child/GoalCard";
import { daysBetween, getChildPrefs, parisDay, studentSummary } from "@/lib/studentStats";
import { examInfo } from "@/lib/examPlan";
import { dueItems, getSrs } from "@/lib/srs";
import { learningPath } from "@/lib/learningPath";

const ICON_MAP: Record<string, LucideIcon> = {
  pencil: PenTool, zap: Zap, flame: Star, star: Star, crown: Trophy,
  check: CheckCircle, trophy: Trophy, brain: BrainCircuit, sparkles: Star,
  graduation: Star, book: BookOpen, map: Star, library: BookOpen,
  sword: Star, swords: Star, medal: Trophy, gem: Star, crystal: Star,
  divine: Star, shield: CheckCircle, bullseye: Star, bookmark: BookOpen,
  scroll: BookOpen, owl: Star, universe: Star,
};

interface Badge { id: number; name: string; icon: string; color: string }

// Purement un affichage de données propres à l'élève connecté (cours/exercices
// suivants, badges, stats) : aucune interactivité au-delà de la navigation
// (Link) et du widget calendrier, déjà un client island à part. Tout se
// résout donc côté serveur — plus de spinner de chargement, plus d'aller-
// retour client pour la session + les 6 requêtes en Promise.all.
export default async function ChildDashboard() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "child") redirect("/dashboard");

  // USER_SELECT_COLUMNS est une chaîne dynamique (pas un littéral) : comme
  // dans le code client d'origine, supabase-js ne peut pas en inférer les
  // colonnes et retombe sur un type d'erreur générique sans ce `: any`.
  const { data: userData }: { data: any } = await supabaseAdmin
    .from("users")
    .select(USER_SELECT_COLUMNS)
    .eq("id", authUser.id)
    .maybeSingle();
  if (!userData) redirect("/dashboard");

  const level = userData.grade_level;

  // Candidats « à continuer » : les premiers cours du niveau DANS L'ORDRE DE
  // LECTURE, et des exercices du niveau de l'élève (avant : n'importe quel
  // niveau). La progression n'est ensuite lue QUE pour ces candidats — avant,
  // toute la progression de l'élève était téléchargée (plafonnée à 1000 lignes).
  const [{ data: courses }, { data: exercises }, { data: ubadges }, { count: exoCount }] = await Promise.all([
    supabaseAdmin
      .from("courses")
      .select("id, title, subject, level")
      .eq("status", "published")
      .eq("level", level)
      .order("chapter_order", { ascending: true, nullsFirst: false })
      .order("title")
      .limit(10),
    supabaseAdmin
      .from("exercises")
      .select("id, title, difficulty_level")
      .eq("status", "published")
      .eq("level", level)
      .order("id")
      .limit(10),
    supabaseAdmin.from("user_badges").select("badge:badges(id, name, icon, color)").eq("user_id", userData.id).order("earned_at", { ascending: false }).limit(4),
    supabaseAdmin.from("user_exercise_attempts").select("*", { count: "exact", head: true }).eq("user_id", userData.id),
  ]);

  const courseIds = (courses || []).map((c) => c.id);
  const exerciseIds = (exercises || []).map((e) => e.id);
  const [{ data: progress }, { data: attempts }] = await Promise.all([
    courseIds.length
      ? supabaseAdmin.from("user_course_progress").select("course_id").eq("user_id", userData.id).in("course_id", courseIds)
      : Promise.resolve({ data: [] as { course_id: string }[] }),
    exerciseIds.length
      ? supabaseAdmin.from("user_exercise_attempts").select("exercise_id").eq("user_id", userData.id).in("exercise_id", exerciseIds)
      : Promise.resolve({ data: [] as { exercise_id: string }[] }),
  ]);

  const doneCoursesIds = new Set((progress || []).map((p) => p.course_id));
  const nextCourse = (courses || []).find((c) => !doneCoursesIds.has(c.id)) || (courses || [])[0] || null;

  const doneExoIds = new Set((attempts || []).map((a) => a.exercise_id));
  const nextExercise = (exercises || []).find((e) => !doneExoIds.has(e.id)) || (exercises || [])[0] || null;

  // Objectif du jour, série, révisions à faire et parcours recommandé : de quoi savoir quoi faire en arrivant.
  const [summary, srsState, path] = await Promise.all([
    studentSummary(userData.id),
    getSrs(userData.id),
    learningPath({ id: userData.id, gradeLevel: userData.grade_level || null, placementScore: userData.onboarding_quiz_score ?? null }),
  ]);
  const dueReviews = dueItems(srsState, 1000).length;
  const prefs = await getChildPrefs(userData.id);
  const exam = examInfo(userData.grade_level);
  const examDays = prefs.examDate ? daysBetween(parisDay(), prefs.examDate) : null;
  const showExam = exam.key !== "generic" || (examDays !== null && examDays >= 0);

  const earnedBadges = ((ubadges || []) as unknown as { badge: Badge | null }[])
    .map((ub) => ub.badge)
    .filter((b): b is Badge => Boolean(b));
  const stats = { badges: earnedBadges.length, exercises: exoCount ?? 0 };

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
                Bonjour, {userData.first_name} !
              </h1>
              <p className="text-xl opacity-90 flex items-center gap-2">
                <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-3 py-1 rounded-full">{level ? getCatalogLevelLabel(level) : "Niveau"}</span>
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
            { href: "/child/minigames", icon: Gamepad2, label: "Mini-jeux", desc: "Défie-toi et grimpe au classement", color: "bg-indigo-100 text-indigo-600", action: "Jouer" },
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

        <GoalCard
          today={summary.today}
          dailyGoal={summary.dailyGoal}
          streak={summary.streak}
          last7={summary.last7}
          weekTotal={summary.weekTotal}
          weeklyTarget={summary.weeklyTarget}
          dueReviews={dueReviews}
        />

        {showExam && (
          <Link href="/child/examens" className="group block mb-8">
            <div className="bg-[var(--greek-blue)] text-white rounded-[20px] p-5 shadow-sm flex items-center justify-between gap-4 hover:shadow-xl transition-all">
              <div className="flex items-center gap-4 min-w-0">
                <GraduationCap className="w-9 h-9 text-[var(--greek-gold)] shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-lg leading-tight">{exam.label}</p>
                  <p className="text-sm opacity-80">{examDays !== null && examDays >= 0 ? `J-${examDays} · ton parcours semaine par semaine` : "Choisis la date et prépare-toi semaine par semaine"}</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 shrink-0 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        )}

        {/* Parcours recommandé */}
        {path.length > 0 && (
          <div className="bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)] mb-8">
            <div className="flex items-center gap-3 mb-1">
              <Compass className="w-5 h-5 text-[var(--greek-gold)]" />
              <h2 className="text-xl font-bold text-[var(--greek-blue)]">Ton parcours</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">Choisi pour toi d&apos;après ton test de départ, tes erreurs et le programme.</p>
            <ol className="space-y-3">
              {path.map((step, i) => (
                <li key={step.courseId} className="flex items-center gap-4 rounded-2xl border border-[rgba(197,161,72,0.25)] bg-[var(--greek-cream)]/40 p-4">
                  <span className="w-9 h-9 rounded-full bg-[var(--greek-blue)] text-white font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-800 text-sm truncate">{step.title}</p>
                    <p className="text-xs text-gray-500">{step.reason}</p>
                  </div>
                  <GlassButton href={`/child/cours/${step.courseId}`} variant="navy" size="sm" className="whitespace-nowrap">
                    <Play className="w-3 h-3 fill-current" /> {i === 0 ? "Commencer" : "Voir"}
                  </GlassButton>
                </li>
              ))}
            </ol>
          </div>
        )}

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
                <GlassButton href={`/child/cours/${nextCourse.id}`} variant="navy" size="sm" className="whitespace-nowrap">
                  <Play className="w-3 h-3 fill-current" /> Démarrer
                </GlassButton>
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
                <GlassButton href={`/child/exercises/${nextExercise.id}`} variant="navy" size="sm" className="whitespace-nowrap">
                  <Play className="w-3 h-3 fill-current" /> Faire
                </GlassButton>
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
        <div className="mb-8">
          <MiniCalendarWidget authId={authUser.authId} ownerId={userData.id} isParent={false} title="Mon Calendrier" fullCalendarHref="/child/calendar" />
        </div>

        {/* Mes Trophées — réels */}
        <div className="bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)]">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-[var(--greek-bronze)]" />
              <h2 className="text-xl font-bold text-[var(--greek-blue)]">Mes Trophées</h2>
            </div>
            <GlassButton href="/child/badges" variant="outline" size="sm" rounded="xl">
              Voir tout
            </GlassButton>
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
              {earnedBadges.map((b) => {
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
