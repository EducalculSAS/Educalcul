import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { selectAllPages } from "@/lib/selectAllPages";
import type { MissionStats } from "@/lib/cosmetics/catalog";

/** Compteurs d'activité d'un élève : ce qui sert à la fois aux badges et aux missions de contours. */
export interface ActivityCounts {
  exoCount: number;
  correctCount: number;
  quizCount: number;
  courseCount: number;
  perfectQuizzes: number;
  mathadorPoints: number;
  minigamesCount: number;
}

export async function loadActivityCounts(userId: number): Promise<ActivityCounts> {
  const [
    { count: exoCount }, { count: correctCount }, { count: quizCount }, { count: courseCount }, { count: minigamesCount },
    quizScores, mathadorScores,
  ] = await Promise.all([
    // Réussis (ou terminés quand aucun seuil n'était défini : passed IS NULL)
    supabaseAdmin.from("user_exercise_attempts").select("*", { count: "exact", head: true }).eq("user_id", userId).or("passed.eq.true,passed.is.null"),
    supabaseAdmin.from("user_exercise_attempts").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("is_correct", true),
    supabaseAdmin.from("user_quiz_attempts").select("*", { count: "exact", head: true }).eq("user_id", userId).or("passed.eq.true,passed.is.null"),
    supabaseAdmin.from("user_course_progress").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabaseAdmin.from("minigame_sessions").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("status", "completed"),
    selectAllPages<{ score: number; total_questions: number }>((from, to) =>
      supabaseAdmin.from("user_quiz_attempts").select("score, total_questions").eq("user_id", userId).order("id").range(from, to),
    ),
    // Somme cumulée des scores Mathador (max 13 pts par partie).
    selectAllPages<{ score: number | null }>((from, to) =>
      supabaseAdmin.from("minigame_sessions").select("score").eq("user_id", userId).eq("game_type", "mathador").eq("status", "completed").order("id").range(from, to),
    ),
  ]);
  return {
    exoCount: exoCount ?? 0,
    correctCount: correctCount ?? 0,
    quizCount: quizCount ?? 0,
    courseCount: courseCount ?? 0,
    minigamesCount: minigamesCount ?? 0,
    perfectQuizzes: quizScores.filter((q) => q.total_questions > 0 && q.score === q.total_questions).length,
    mathadorPoints: mathadorScores.reduce((sum, s) => sum + (s.score || 0), 0),
  };
}

export function toMissionStats(c: ActivityCounts, user: { login_streak: number | null; login_count: number | null }, badgesCount: number): MissionStats {
  return {
    exo: c.exoCount,
    cours: c.courseCount,
    quiz: c.quizCount,
    quizPerfect: c.perfectQuizzes,
    loginStreak: user.login_streak ?? 0,
    loginCount: user.login_count ?? 0,
    mathador: c.mathadorPoints,
    exoCorrect: c.correctCount,
    minigames: c.minigamesCount,
    badges: badgesCount,
  };
}
