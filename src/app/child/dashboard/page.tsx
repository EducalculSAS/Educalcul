import Emblem3D from "@/components/Emblem3D";
import Link from "@/components/AppLink";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getServerUser } from "@/lib/supabase/server";
import { USER_SELECT_COLUMNS } from "@/lib/userColumns";
import { getCatalogLevelLabel } from "@/lib/constants";
import { ArrowRight, Play } from "lucide-react";
import DashboardTile from "@/components/DashboardTile";
import DashboardTrophies from "@/components/child/DashboardTrophies";
import { badgeTiers } from "@/lib/badgeTiers";
import { nextBadgeGoals } from "@/lib/badgeGoals";
import { loadActivityCounts } from "@/lib/cosmetics/stats";
import MiniCalendarWidget from "@/components/calendar/MiniCalendarWidget";
import GlassButton from "@/components/ui/GlassButton";
import GoalCard from "@/components/child/GoalCard";
import { daysBetween, getChildPrefs, parisDay, studentSummary } from "@/lib/studentStats";
import { examInfo } from "@/lib/examPlan";
import { dueItems, getSrs } from "@/lib/srs";
import { learningPath } from "@/lib/learningPath";

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
  const { data: userData } = await supabaseAdmin
    .from("users")
    .select(`${USER_SELECT_COLUMNS}, onboarding_quiz_score` as const)
    .eq("id", authUser.id)
    .maybeSingle();
  if (!userData) redirect("/dashboard");

  const level = userData.grade_level;

  // Candidats « à continuer » : les premiers cours du niveau DANS L'ORDRE DE
  // LECTURE, et des exercices du niveau de l'élève (avant : n'importe quel
  // niveau). La progression n'est ensuite lue QUE pour ces candidats — avant,
  // toute la progression de l'élève était téléchargée (plafonnée à 1000 lignes).
  const [{ data: courses }, { data: exercises }, { data: allBadges }, { data: ubadges }, { count: exoCount }, counts] = await Promise.all([
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
    supabaseAdmin.from("badges").select("id, name, icon, description, requirement_type, requirement_value").eq("is_active", true).order("display_order"),
    supabaseAdmin.from("user_badges").select("badge_id").eq("user_id", userData.id).order("earned_at", { ascending: false }),
    supabaseAdmin.from("user_exercise_attempts").select("*", { count: "exact", head: true }).eq("user_id", userData.id),
    loadActivityCounts(userData.id),
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

  // Trophées : les badges réellement obtenus (du plus récent au plus ancien) et, par catégorie, le prochain à viser
  // avec l'avancement de l'élève — mêmes compteurs que l'attribution des badges (api/child/check-badges).
  const badges = allBadges || [];
  const badgeById = new Map(badges.map((b) => [b.id, b]));
  const earnedIds = (ubadges || []).map((ub) => ub.badge_id).filter((id) => badgeById.has(id));
  const latestBadges = earnedIds.slice(0, 4).map((id) => badgeById.get(id)!);
  const badgeGoals = nextBadgeGoals(badges, earnedIds, {
    exercise_count: counts.exoCount,
    exercise_correct: counts.correctCount,
    quiz_count: counts.quizCount,
    quiz_perfect: counts.perfectQuizzes,
    course_count: counts.courseCount,
    login_streak: userData.login_streak ?? 0,
    login_count: userData.login_count ?? 0,
  });
  const stats = { badges: earnedIds.length, exercises: exoCount ?? 0 };

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
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-5 mb-10">
          <DashboardTile href="/child/cours" emblem="book" label="Mes cours" desc="Découvre de nouvelles leçons" action="Commencer" />
          <DashboardTile href="/child/exercises" emblem="pencil" label="Exercices" desc="Entraîne-toi et progresse" action="S'entraîner" />
          <DashboardTile href="/child/quiz" emblem="quiz" label="Quiz" desc="Teste tes connaissances" action="Jouer" />
          <DashboardTile href="/child/minigames" emblem="gamepad" label="Mini-jeux" desc="Défie-toi et grimpe au classement" action="Jouer" />
          <DashboardTile href="/child/forum" emblem="chat" label="Forum" desc="Pose tes questions" action="Y aller" />
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
                <span className="shrink-0"><Emblem3D kind="cap" size={48} float={false} onDark /></span>
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
              <Emblem3D kind="compass" size={28} float={false} />
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
            <Emblem3D kind="star" size={28} float={false} />
            <h2 className="text-xl font-bold text-[var(--greek-blue)]">À faire ensuite</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Prochain cours */}
            {nextCourse ? (
              <div className="bg-blue-50 rounded-2xl p-5 border border-[rgba(197,161,72,0.25)] flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className="shrink-0"><Emblem3D kind="book" size={52} float={false} /></span>
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
                <span className="grayscale opacity-70"><Emblem3D kind="book" size={40} float={false} /></span>
                <span className="text-sm">Aucun cours disponible pour ton niveau.</span>
              </div>
            )}

            {/* Prochain exercice */}
            {nextExercise ? (
              <div className="bg-orange-50 rounded-2xl p-5 border border-[rgba(197,161,72,0.25)] flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className="shrink-0"><Emblem3D kind="pencil" size={52} float={false} /></span>
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
              <div className="bg-gray-50 rounded-2xl p-5 border border-[rgba(197,161,72,0.25)] flex items-center gap-3 text-gray-500">
                <Emblem3D kind="trophy" size={40} float={false} />
                <span className="text-sm">Tous les exercices ont été faits !</span>
              </div>
            )}
          </div>
        </div>

        {/* Calendrier */}
        <div className="mb-8">
          <MiniCalendarWidget authId={authUser.authId} ownerId={userData.id} isParent={false} title="Mon Calendrier" fullCalendarHref="/child/calendar" />
        </div>

        <DashboardTrophies latest={latestBadges} earnedCount={earnedIds.length} totalCount={badges.length} goals={badgeGoals} tiers={badgeTiers(badges)} />
      </div>
    </div>
  );
}
