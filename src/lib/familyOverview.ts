import type { Loose } from "@/types/loose";
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { relativeTime } from "@/lib/relativeTime";
import { getChildPrefsMany, studentSummaries, type ChildPrefs, type StudentSummary } from "@/lib/studentStats";

/** Les enfants d'un parent avec tout ce qu'il faut pour leur fiche : même chargement pour le tableau de bord et « Mes enfants ». */

export interface FamilyChild {
  id: number;
  first_name: string | null;
  last_name: string | null;
  grade_level: string | null;
  child_username: string | null;
  avatar: string | null;
  equipped_border: string | null;
  last_active_at: string | null;
}

export interface ChildStats {
  exerciseCount: number;
  quizCount: number;
  successRate: number;
  lastActivity: { type: string; title: string; relativeTime: string } | null;
}

export interface FamilyEntry {
  child: FamilyChild;
  stats: ChildStats;
  summary: StudentSummary;
  prefs: ChildPrefs;
}

async function fetchChildStats(childId: number): Promise<ChildStats> {
  const [{ count: totalEx }, { count: totalQuiz }, { count: correctCount }, { data: lastQuiz }, { data: lastEx }] = await Promise.all([
    supabaseAdmin.from("user_exercise_attempts").select("*", { count: "exact", head: true }).eq("user_id", childId),
    supabaseAdmin.from("user_quiz_attempts").select("*", { count: "exact", head: true }).eq("user_id", childId),
    supabaseAdmin.from("user_exercise_attempts").select("*", { count: "exact", head: true }).eq("user_id", childId).eq("is_correct", true),
    supabaseAdmin.from("user_quiz_attempts").select("completed_at, quizzes(title)").eq("user_id", childId).order("completed_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("user_exercise_attempts").select("attempted_at, exercises(title)").eq("user_id", childId).order("attempted_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const successRate = (totalEx || 0) > 0 ? Math.round(((correctCount || 0) / (totalEx || 1)) * 100) : 0;
  const activities: { type: string; title: string; date: string }[] = [];
  if (lastQuiz) activities.push({ type: "Quiz", title: (lastQuiz as Loose).quizzes?.title || "Quiz", date: (lastQuiz as Loose).completed_at });
  if (lastEx) activities.push({ type: "Exercice", title: (lastEx as Loose).exercises?.title || "Exercice", date: (lastEx as Loose).attempted_at });
  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    exerciseCount: totalEx || 0,
    quizCount: totalQuiz || 0,
    successRate,
    lastActivity: activities[0] ? { ...activities[0], relativeTime: relativeTime(activities[0].date) } : null,
  };
}

export async function loadFamily(parentId: number): Promise<FamilyEntry[]> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, first_name, last_name, grade_level, child_username, avatar, equipped_border, last_active_at")
    .eq("role", "child")
    .eq("parent_id", parentId)
    .order("first_name");
  const children = (data ?? []) as FamilyChild[];
  const ids = children.map((c) => c.id);
  const [stats, summaries, prefs] = await Promise.all([Promise.all(children.map((c) => fetchChildStats(c.id))), studentSummaries(ids), getChildPrefsMany(ids)]);
  return children.map((child, i) => ({ child, stats: stats[i], summary: summaries.get(child.id)!, prefs: prefs.get(String(child.id))! }));
}
