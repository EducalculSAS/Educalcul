import { supabaseAdmin } from "@/lib/supabaseClient";
import { one } from "@/lib/relations";
import type { Row } from "@/types/db";

type Named<T> = T | null;
/** Fiche complète d'un utilisateur côté admin (page détail). */
export interface AdminUserDetail {
  user: Row<"users">;
  stats: { exercise_attempts: number; quiz_attempts: number; course_progress: number; minigame_sessions: number };
  subscription: Row<"subscriptions"> | null;
  children: Pick<Row<"users">, "id" | "first_name" | "last_name" | "grade_level" | "avatar" | "equipped_border">[];
  notifications: Row<"admin_notifications">[];
  badges: { badge: Named<{ name: string; icon: string | null }> }[];
  forum_posts: (Pick<Row<"forum_posts">, "id" | "title" | "content" | "created_at" | "is_locked"> & { category: Named<{ name: string }> })[];
  forum_comments: (Pick<Row<"forum_comments">, "id" | "content" | "created_at"> & { post: Named<{ title: string }> })[];
  reports: (Row<"forum_reports"> & { reporter: Named<{ first_name: string | null; last_name: string | null }>; post: Named<{ title: string }>; comment: Named<{ content: string }> })[];
  login_history: Row<"user_login_history">[];
  exercise_attempts: (Pick<Row<"user_exercise_attempts">, "id" | "exercise_id" | "score" | "total_points" | "score_percent" | "passed" | "status" | "completed_at" | "attempted_at"> & { exercises: Named<{ title: string }> })[];
  quiz_attempts: (Pick<Row<"user_quiz_attempts">, "id" | "quiz_id" | "score" | "total_points" | "score_percent" | "passed" | "status" | "completed_at" | "time_spent_seconds"> & { quizzes: Named<{ title: string }> })[];
  course_progress: (Pick<Row<"user_course_progress">, "id" | "course_id" | "chapter_index" | "status" | "completed_at"> & { courses: Named<{ title: string }> })[];
  support_tickets: Pick<Row<"support_tickets">, "id" | "subject" | "status" | "priority" | "created_at" | "updated_at">[];
  minigame_sessions: Pick<Row<"minigame_sessions">, "id" | "game_type" | "score" | "max_score" | "duration_seconds" | "status" | "created_at" | "completed_at">[];
}

export async function fetchAdminUserDetail(id: string): Promise<AdminUserDetail | null> {
  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !user) return null;

  const [
    { count: ea }, { count: qa }, { count: cp }, { count: mg },
    { data: sub }, { data: children }, { data: notifs }, { data: bdg },
    { data: posts }, { data: comments }, { data: reports }, { data: loginHistory },
    { data: exerciseAttempts }, { data: quizAttempts }, { data: courseProgress },
    { data: tickets }, { data: minigameSessions },
  ] = await Promise.all([
    supabaseAdmin.from("user_exercise_attempts").select("*", { count: "exact", head: true }).eq("user_id", id),
    supabaseAdmin.from("user_quiz_attempts").select("*", { count: "exact", head: true }).eq("user_id", id),
    supabaseAdmin.from("user_course_progress").select("*", { count: "exact", head: true }).eq("user_id", id),
    supabaseAdmin.from("minigame_sessions").select("*", { count: "exact", head: true }).eq("user_id", id).eq("status", "completed"),
    supabaseAdmin.from("subscriptions").select("*").eq("user_id", user.auth_id).maybeSingle(),
    supabaseAdmin.from("users").select("id, first_name, last_name, grade_level, avatar, equipped_border").eq("parent_id", id).eq("role", "child"),
    supabaseAdmin.from("admin_notifications").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
    supabaseAdmin.from("user_badges").select("badge:badges(name, icon)").eq("user_id", id),
    supabaseAdmin.from("forum_posts").select("id, title, content, created_at, is_locked, category:forum_categories!category_id(name)").eq("author_id", id).order("created_at", { ascending: false }).limit(10),
    supabaseAdmin.from("forum_comments").select("id, content, created_at, post:forum_posts!post_id(title)").eq("author_id", id).order("created_at", { ascending: false }).limit(10),
    supabaseAdmin.from("forum_reports").select("*, reporter:users!reporter_id(first_name, last_name), post:forum_posts!post_id(title), comment:forum_comments!comment_id(content)").eq("reported_user_id", id).order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("user_login_history").select("*").eq("user_id", id).order("logged_at", { ascending: false }).limit(200),
    supabaseAdmin.from("user_exercise_attempts")
      .select("id, exercise_id, score, total_points, score_percent, passed, status, completed_at, attempted_at, exercises(title)")
      .eq("user_id", id).order("attempted_at", { ascending: false }).limit(20),
    supabaseAdmin.from("user_quiz_attempts")
      .select("id, quiz_id, score, total_points, score_percent, passed, status, completed_at, time_spent_seconds, quizzes(title)")
      .eq("user_id", id).order("completed_at", { ascending: false }).limit(20),
    supabaseAdmin.from("user_course_progress")
      .select("id, course_id, chapter_index, status, completed_at, courses(title)")
      .eq("user_id", id).order("completed_at", { ascending: false }).limit(20),
    supabaseAdmin.from("support_tickets")
      .select("id, subject, status, priority, created_at, updated_at")
      .eq("user_id", user.auth_id).order("created_at", { ascending: false }).limit(20),
    supabaseAdmin.from("minigame_sessions")
      .select("id, game_type, score, max_score, duration_seconds, status, created_at, completed_at")
      .eq("user_id", id).order("created_at", { ascending: false }).limit(20),
  ]);

  // Les relations « vers un » (category, post, exercises…) arrivent en objet : le type déduit de la chaîne `select` les annonce à tort en
  // tableau. C'est le seul endroit où l'on tranche ; tout le reste de la page est typé par AdminUserDetail.
  return {
    user,
    stats: { exercise_attempts: ea ?? 0, quiz_attempts: qa ?? 0, course_progress: cp ?? 0, minigame_sessions: mg ?? 0 },
    subscription: sub ?? null, children: children ?? [],
    notifications: notifs ?? [], badges: (bdg ?? []).map((b) => ({ ...b, badge: one(b.badge) ?? null })),
    forum_posts: (posts ?? []).map((p) => ({ ...p, category: one(p.category) ?? null })),
    forum_comments: (comments ?? []).map((c) => ({ ...c, post: one(c.post) ?? null })),
    reports: (reports ?? []).map((r) => ({ ...r, reporter: one(r.reporter) ?? null, post: one(r.post) ?? null, comment: one(r.comment) ?? null })),
    login_history: loginHistory ?? [],
    exercise_attempts: (exerciseAttempts ?? []).map((a) => ({ ...a, exercises: one(a.exercises) ?? null })),
    quiz_attempts: (quizAttempts ?? []).map((a) => ({ ...a, quizzes: one(a.quizzes) ?? null })),
    course_progress: (courseProgress ?? []).map((c) => ({ ...c, courses: one(c.courses) ?? null })),
    support_tickets: tickets ?? [],
    minigame_sessions: minigameSessions ?? [],
  };
}
