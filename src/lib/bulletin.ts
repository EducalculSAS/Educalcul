import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSrs } from "@/lib/srs";
import { addDays, currentStreak, getChildPrefs, loadActivity, longestStreak, mondayOf, parisDay } from "@/lib/studentStats";

/**
 * Bulletin d'un élève : niveau par chapitre, évolution sur 8 semaines, points forts et à travailler. Les mêmes données
 * servent la page imprimable du parent (PDF) et le lien de suivi en lecture seule (second adulte, répétiteur).
 */

export interface Bulletin {
  child: { id: number; firstName: string; gradeLevel: string | null };
  generatedAt: string;
  kpis: { activities: number; activeDays: number; streak: number; longest: number; exerciseAvg: number | null; quizAvg: number | null; coursesDone: number; badges: number };
  weeks: { label: string; activities: number; avgScore: number | null }[];
  chapters: { name: string; courses: number; done: number; avgScore: number | null }[];
  strong: string[];
  weak: string[];
  review: { inBook: number; mastered: number };
  goals: { dailyGoal: number; weeklyTarget: number | null };
  comment: string;
}

interface Attempt {
  score_percent: number | null;
  completed_at: string | null;
  status: string | null;
  attempts_history: { score_percent?: number | null; completed_at?: string }[] | null;
  exercise_id?: string | number;
}

const avg = (values: number[]) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null);

const WEEKS = 8;

function observation(first: string, b: Omit<Bulletin, "comment">): string {
  const parts: string[] = [];
  const perWeek = b.weeks.map((w) => w.activities);
  const recent = perWeek.slice(-2).reduce((a, c) => a + c, 0);
  const before = perWeek.slice(-4, -2).reduce((a, c) => a + c, 0);
  if (b.kpis.activities === 0) return `${first} n'a pas encore d'activité sur la période : un premier exercice suffit pour démarrer le suivi.`;
  parts.push(`${first} a fait ${b.kpis.activities} activité${b.kpis.activities > 1 ? "s" : ""} sur ${b.kpis.activeDays} jour${b.kpis.activeDays > 1 ? "s" : ""} actif${b.kpis.activeDays > 1 ? "s" : ""} ces ${WEEKS} dernières semaines.`);
  if (recent > before * 1.2 + 1) parts.push("Le rythme est en hausse ces deux dernières semaines.");
  else if (recent + 1 < before * 0.7) parts.push("Le rythme a ralenti ces deux dernières semaines : un objectif plus léger peut aider à reprendre.");
  else parts.push("Le rythme est régulier.");
  if (b.kpis.streak >= 3) parts.push(`Série en cours : ${b.kpis.streak} jours de suite.`);
  const best = [...b.chapters].filter((c) => c.avgScore !== null).sort((x, y) => (y.avgScore ?? 0) - (x.avgScore ?? 0))[0];
  const worst = [...b.chapters].filter((c) => c.avgScore !== null).sort((x, y) => (x.avgScore ?? 0) - (y.avgScore ?? 0))[0];
  if (best && worst && best.name !== worst.name) parts.push(`Point fort : ${best.name} (${best.avgScore} %). À consolider : ${worst.name} (${worst.avgScore} %).`);
  else if (best) parts.push(`Résultat moyen sur ${best.name} : ${best.avgScore} %.`);
  if (b.review.inBook > 0) parts.push(`${b.review.inBook} question${b.review.inBook > 1 ? "s" : ""} à retravailler dans le cahier d'erreurs.`);
  return parts.join(" ");
}

export async function buildBulletin(childId: number): Promise<Bulletin | null> {
  const { data: child } = await supabaseAdmin.from("users").select("id, first_name, grade_level, role").eq("id", childId).maybeSingle();
  if (!child || child.role !== "child") return null;

  const today = parisDay();
  const start = addDays(mondayOf(today), -7 * (WEEKS - 1));
  const sinceIso = new Date(`${start}T00:00:00Z`).toISOString();

  const [activity, prefs, srs, badges, profile, exAttempts, qzAttempts, courses] = await Promise.all([
    loadActivity(childId, 70),
    getChildPrefs(childId),
    getSrs(childId),
    supabaseAdmin.from("user_badges").select("id", { count: "exact", head: true }).eq("user_id", childId),
    supabaseAdmin.from("calia_student_profile").select("mastered_notions, weak_notions").eq("user_id", childId).maybeSingle(),
    supabaseAdmin.from("user_exercise_attempts").select("exercise_id, score_percent, completed_at, status, attempts_history").eq("user_id", childId).gte("completed_at", sinceIso).limit(3000),
    supabaseAdmin.from("user_quiz_attempts").select("score_percent, completed_at, status, attempts_history").eq("user_id", childId).gte("completed_at", sinceIso).limit(3000),
    child.grade_level
      ? supabaseAdmin.from("courses").select("id, title, chapter_name").eq("status", "published").eq("level", child.grade_level).limit(800)
      : Promise.resolve({ data: [] as { id: number; title: string; chapter_name: string | null }[] }),
  ]);

  // Scores par semaine : chaque tentative terminée (historique compris).
  const scoreEvents: { day: string; score: number }[] = [];
  const collect = (rows: Attempt[] | null) => {
    for (const row of rows ?? []) {
      const history = (row.attempts_history ?? []).filter((h) => h?.completed_at && typeof h.score_percent === "number");
      if (history.length) history.forEach((h) => scoreEvents.push({ day: parisDay(h.completed_at!), score: h.score_percent as number }));
      else if (row.status === "completed" && typeof row.score_percent === "number" && row.completed_at) scoreEvents.push({ day: parisDay(row.completed_at), score: row.score_percent });
    }
  };
  collect(exAttempts.data as Attempt[] | null);
  collect(qzAttempts.data as Attempt[] | null);

  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const from = addDays(start, i * 7);
    const to = addDays(from, 6);
    let activities = 0;
    for (let d = from; d <= to; d = addDays(d, 1)) activities += activity.perDay[d] ?? 0;
    const scores = scoreEvents.filter((e) => e.day >= from && e.day <= to).map((e) => e.score);
    const label = new Date(`${from}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    return { label, activities, avgScore: avg(scores) };
  });

  const activeDays = Object.entries(activity.perDay).filter(([d, n]) => d >= start && n > 0).length;
  const activities = weeks.reduce((a, w) => a + w.activities, 0);
  const exerciseScores = ((exAttempts.data ?? []) as Attempt[]).filter((r) => r.status === "completed" && typeof r.score_percent === "number").map((r) => r.score_percent as number);
  const quizScores = ((qzAttempts.data ?? []) as Attempt[]).filter((r) => r.status === "completed" && typeof r.score_percent === "number").map((r) => r.score_percent as number);

  // Niveau par chapitre : cours terminés et moyenne des exercices rattachés à ces cours.
  const courseRows = (courses.data ?? []) as { id: number; title: string; chapter_name: string | null }[];
  const courseIds = courseRows.map((c) => c.id);
  const [progress, linkedExercises] = await Promise.all([
    courseIds.length ? supabaseAdmin.from("user_course_progress").select("course_id, status").eq("user_id", childId).in("course_id", courseIds) : Promise.resolve({ data: [] as { course_id: number; status: string }[] }),
    courseIds.length ? supabaseAdmin.from("exercises").select("id, course_id").eq("status", "published").in("course_id", courseIds).limit(3000) : Promise.resolve({ data: [] as { id: string; course_id: number }[] }),
  ]);
  const exerciseIds = (linkedExercises.data ?? []).map((e) => e.id);
  const { data: allExAttempts } = exerciseIds.length
    ? await supabaseAdmin.from("user_exercise_attempts").select("exercise_id, score_percent, status").eq("user_id", childId).eq("status", "completed").in("exercise_id", exerciseIds)
    : { data: [] as { exercise_id: string; score_percent: number | null }[] };
  const doneCourses = new Set((progress.data ?? []).filter((p) => p.status === "completed").map((p) => String(p.course_id)));
  const exerciseCourse = new Map((linkedExercises.data ?? []).map((e) => [String(e.id), String(e.course_id)]));
  const scoresByCourse = new Map<string, number[]>();
  for (const a of allExAttempts ?? []) {
    const cid = exerciseCourse.get(String(a.exercise_id));
    if (cid && typeof a.score_percent === "number") scoresByCourse.set(cid, [...(scoresByCourse.get(cid) ?? []), a.score_percent]);
  }
  const chapterMap = new Map<string, { courses: number; done: number; scores: number[] }>();
  for (const c of courseRows) {
    const name = c.chapter_name || "Autres cours";
    const cur = chapterMap.get(name) ?? { courses: 0, done: 0, scores: [] };
    cur.courses++;
    if (doneCourses.has(String(c.id))) cur.done++;
    cur.scores.push(...(scoresByCourse.get(String(c.id)) ?? []));
    chapterMap.set(name, cur);
  }
  const chapters = [...chapterMap.entries()]
    .map(([name, v]) => ({ name, courses: v.courses, done: v.done, avgScore: avg(v.scores) }))
    .filter((c) => c.done > 0 || c.avgScore !== null)
    .sort((a, b) => b.done - a.done || (b.avgScore ?? 0) - (a.avgScore ?? 0))
    .slice(0, 12);

  const notionNames = (list: unknown) => ((list ?? []) as { notion?: string }[]).map((n) => n.notion).filter((n): n is string => !!n);
  const partial: Omit<Bulletin, "comment"> = {
    child: { id: child.id, firstName: child.first_name || "L'élève", gradeLevel: child.grade_level },
    generatedAt: new Date().toISOString(),
    kpis: {
      activities,
      activeDays,
      streak: currentStreak(activity.perDay, today),
      longest: longestStreak(activity.perDay),
      exerciseAvg: avg(exerciseScores),
      quizAvg: avg(quizScores),
      coursesDone: doneCourses.size,
      badges: badges.count ?? 0,
    },
    weeks,
    chapters,
    strong: notionNames(profile.data?.mastered_notions).slice(0, 6),
    weak: notionNames(profile.data?.weak_notions).slice(0, 6),
    review: { inBook: Object.keys(srs.items).length, mastered: srs.mastered ?? 0 },
    goals: { dailyGoal: prefs.dailyGoal, weeklyTarget: prefs.weeklyTarget },
  };
  return { ...partial, comment: observation(partial.child.firstName, partial) };
}
