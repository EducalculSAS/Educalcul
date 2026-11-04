import { one } from "@/lib/relations";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function fetchAdminStats() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [
    { count: totalUsers },
    { count: activeSubs },
    { count: publishedCourses },
    { count: totalExercises },
    { count: totalQuizzes },
    { count: openTickets },
    { count: pendingReports },
    { count: newUsersWeek },
    { data: recentUsers },
    { data: recentCourses },
    { data: recentPosts },
  ] = await Promise.all([
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('courses').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabaseAdmin.from('exercises').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabaseAdmin.from('quizzes').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabaseAdmin.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'Ouvert').eq('is_archived', false),
    supabaseAdmin.from('forum_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    supabaseAdmin.from('users')
      .select('id, first_name, last_name, role, avatar, equipped_border, created_at')
      .order('created_at', { ascending: false }).limit(6),
    supabaseAdmin.from('courses')
      .select('id, title, subject, level, status, created_at')
      .order('created_at', { ascending: false }).limit(5),
    supabaseAdmin.from('forum_posts')
      .select('id, title, created_at, author:users!author_id(first_name, last_name, child_username)')
      .order('created_at', { ascending: false }).limit(5),
  ]);

  return {
    counts: {
      users: totalUsers ?? 0,
      active_subscriptions: activeSubs ?? 0,
      published_courses: publishedCourses ?? 0,
      exercises: totalExercises ?? 0,
      quizzes: totalQuizzes ?? 0,
      open_tickets: openTickets ?? 0,
      pending_reports: pendingReports ?? 0,
      new_users_week: newUsersWeek ?? 0,
    },
    recent: {
      users: recentUsers ?? [],
      courses: recentCourses ?? [],
      forum_posts: (recentPosts ?? []).map((p) => ({ ...p, author: one(p.author) ?? null })),
    },
  };
}
