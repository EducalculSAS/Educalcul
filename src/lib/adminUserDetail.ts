import { supabaseAdmin } from "@/lib/supabaseClient";

export async function fetchAdminUserDetail(id: string) {
  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !user) return null;

  const [
    { count: ea }, { count: qa }, { count: cp },
    { data: sub }, { data: children }, { data: notifs }, { data: bdg },
    { data: posts }, { data: comments }, { data: reports }, { data: loginHistory },
    { data: exerciseAttempts }, { data: quizAttempts }, { data: courseProgress },
    { data: tickets },
  ] = await Promise.all([
    supabaseAdmin.from("user_exercise_attempts").select("*", { count: "exact", head: true }).eq("user_id", id),
    supabaseAdmin.from("user_quiz_attempts").select("*", { count: "exact", head: true }).eq("user_id", id),
    supabaseAdmin.from("user_course_progress").select("*", { count: "exact", head: true }).eq("user_id", id),
    supabaseAdmin.from("subscriptions").select("*").eq("user_id", user.auth_id).maybeSingle(),
    supabaseAdmin.from("users").select("id, first_name, last_name, grade_level, avatar").eq("parent_id", id).eq("role", "child"),
    supabaseAdmin.from("admin_notifications").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
    supabaseAdmin.from("user_badges").select("badge:badges(name, icon)").eq("user_id", id),
    supabaseAdmin.from("forum_posts").select("id, title, content, created_at, is_locked, category:forum_categories(name)").eq("author_id", id).order("created_at", { ascending: false }).limit(10),
    supabaseAdmin.from("forum_comments").select("id, content, created_at, post:forum_posts(title)").eq("author_id", id).order("created_at", { ascending: false }).limit(10),
    supabaseAdmin.from("forum_reports").select("*, reporter:users!reporter_id(first_name, last_name), post:forum_posts(title), comment:forum_comments(content)").eq("reported_user_id", id).order("created_at", { ascending: false }),
    supabaseAdmin.from("user_login_history").select("*").eq("user_id", id).order("logged_at", { ascending: false }).limit(200),
    supabaseAdmin.from("user_exercise_attempts")
      .select("id, exercise_id, score, total_points, score_percent, passed, status, completed_at, attempted_at, exercises(title)")
      .eq("user_id", id).order("attempted_at", { ascending: false }).limit(20),
    supabaseAdmin.from("user_quiz_attempts")
      .select("id, quiz_id, score, total_points, score_percent, passed, status, completed_at, time_spent_seconds, quizzes(title)")
      .eq("user_id", id).order("completed_at", { ascending: false }).limit(20),
    supabaseAdmin.from("user_course_progress")
      .select("id, course_id, chapter_index, status, completed_at, courses(title, content_json)")
      .eq("user_id", id).order("completed_at", { ascending: false }).limit(20),
    supabaseAdmin.from("support_tickets")
      .select("id, subject, status, priority, created_at, updated_at")
      .eq("user_id", user.auth_id).order("created_at", { ascending: false }).limit(20),
  ]);

  return {
    user,
    stats: { exercise_attempts: ea ?? 0, quiz_attempts: qa ?? 0, course_progress: cp ?? 0 },
    subscription: sub ?? null, children: children ?? [],
    notifications: notifs ?? [], badges: bdg ?? [],
    forum_posts: posts ?? [], forum_comments: comments ?? [], reports: reports ?? [],
    login_history: loginHistory ?? [],
    exercise_attempts: exerciseAttempts ?? [],
    quiz_attempts: quizAttempts ?? [],
    course_progress: courseProgress ?? [],
    support_tickets: tickets ?? [],
  };
}
