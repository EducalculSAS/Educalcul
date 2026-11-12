import Emblem3D from "@/components/Emblem3D";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getServerUser } from "@/lib/supabase/server";
import { USER_SELECT_COLUMNS } from "@/lib/userColumns";
import { getCatalogLevelLabel } from "@/lib/constants";
import { Play } from "lucide-react";
import DashboardTile from "@/components/DashboardTile";
import DashboardHero from "@/components/DashboardHero";
import BadgeEmblem from "@/components/BadgeEmblem";
import DashboardTrophies from "@/components/child/DashboardTrophies";
import { badgeTiers } from "@/lib/badgeTiers";
import { nextBadgeGoals } from "@/lib/badgeGoals";
import { loadActivityCounts } from "@/lib/cosmetics/stats";
import MiniCalendarWidget from "@/components/calendar/MiniCalendarWidget";
import GlassButton from "@/components/ui/GlassButton";
import GoalCard from "@/components/child/GoalCard";
import { daysBetween, getChildPrefs, parisDay, studentSummary } from "@/lib/studentStats";
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
  const [{ data: courses }, { data: exercises }, { data: allBadges }, { data: ubadges }, counts] = await Promise.all([
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
  const examDays = prefs.examDate ? daysBetween(parisDay(), prefs.examDate) : null;

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
  const tiers = badgeTiers(badges);
  // Les badges que l'élève a choisi d'afficher à côté de son nom (les mêmes que sur le forum).
  const featured = ((userData.featured_badges as number[] | null) || []).map((id) => badgeById.get(id)).filter((b): b is NonNullable<typeof b> => !!b && earnedIds.includes(b.id)).slice(0, 3);

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-12">
      <DashboardHero
        name={userData.first_name || userData.child_username || "toi"}
        avatar={userData.avatar}
        equippedBorder={userData.equipped_border}
        nameColor={userData.name_color}
        pill={level ? getCatalogLevelLabel(level) : "Élève"}
        tagline={summary.today >= summary.dailyGoal ? "Objectif du jour atteint, bravo !" : summary.streak > 1 ? `${summary.streak} jours de suite : continue sur ta lancée.` : "Prêt à apprendre ?"}
        profileHref="/child/profile"
        extra={featured.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {featured.map((b) => (
              <li key={b.id} className="flex items-center gap-1.5 bg-white/10 pl-1 pr-2.5 py-1 rounded-full border border-white/20">
                <BadgeEmblem badge={{ icon: b.icon, requirement_type: b.requirement_type, tier: tiers[b.id] ?? 0 }} size={26} />
                <span className="text-xs font-bold text-white/90">{b.name}</span>
              </li>
            ))}
          </ul>
        )}
      />

      <div className="container mx-auto max-w-6xl px-4">
        {/* Navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-10">
          <DashboardTile href="/child/cours" emblem="book" label="Mes cours" desc="Découvre de nouvelles leçons" action="Commencer" />
          <DashboardTile href="/child/exercises" emblem="pencil" label="Exercices" desc="Entraîne-toi et progresse" action="S'entraîner" />
          <DashboardTile href="/child/quiz" emblem="quiz" label="Quiz" desc="Teste tes connaissances" action="Jouer" />
          <DashboardTile href="/child/minigames" emblem="gamepad" label="Mini-jeux" desc="Défie-toi et grimpe au classement" action="Jouer" />
          <DashboardTile href="/child/revisions" emblem="clock" label="À revoir" desc={dueReviews > 0 ? `${dueReviews} question${dueReviews > 1 ? "s" : ""} à revoir aujourd'hui` : "Retravaille tes erreurs au bon moment"} action="Réviser" />
          <DashboardTile href="/child/examens" emblem="cap" label="Examens" desc={examDays !== null && examDays >= 0 ? `J-${examDays} : ton parcours de révision` : "Prépare un contrôle ou un examen"} action="Préparer" />
          <DashboardTile href="/child/forum" emblem="chat" label="Forum" desc="Pose tes questions" action="Y aller" />
          <DashboardTile href="/child/badges" emblem="trophy" label="Trophées" desc="Badges, contours et titres" action="Voir" />
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

        <DashboardTrophies latest={latestBadges} earnedCount={earnedIds.length} totalCount={badges.length} goals={badgeGoals} tiers={tiers} />
      </div>
    </div>
  );
}
