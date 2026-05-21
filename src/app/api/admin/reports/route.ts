import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
// Force dynamic — never cache
export const dynamic = "force-dynamic";

async function safeCount(table: string, filter?: (q: any) => any): Promise<number> {
  try {
    let q = supabaseAdmin.from(table).select("*", { count: "exact", head: true });
    if (filter) q = filter(q);
    const { count, error } = await q;
    return error ? 0 : (count ?? 0);
  } catch { return 0; }
}

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);

    // ── Counts ──────────────────────────────────────────────────────────────
    const [
      totalUsers, totalParents, totalChildren,
      newToday, newThisWeek,
      totalCourses, totalExercises, totalQuizzes,
      activeSubs, forumPosts, forumComments,
      exerciseAttempts, courseProgress,
      parrainageCodes, parrainageUses,
    ] = await Promise.all([
      safeCount("users"),
      safeCount("users", q => q.eq("role", "parent")),
      safeCount("users", q => q.eq("role", "child")),
      safeCount("users", q => q.gte("created_at", todayStart.toISOString())),
      safeCount("users", q => q.gte("created_at", sevenDaysAgo.toISOString())),
      safeCount("courses", q => q.eq("status", "published")),
      safeCount("exercises", q => q.eq("status", "published")),
      safeCount("quizzes", q => q.eq("status", "published")),
      safeCount("subscriptions", q => q.eq("status", "active")),
      safeCount("forum_posts"),
      safeCount("forum_comments"),
      safeCount("user_exercise_attempts"),
      safeCount("user_course_progress"),
      safeCount("referral_codes", q => q.not("owner_user_id", "is", null).eq("is_active", true)),
      supabaseAdmin.from("referral_codes").select("current_uses").then(r =>
        (r.data || []).reduce((a: number, c: any) => a + (c.current_uses || 0), 0)
      ),
    ]);

    // ── Avg quiz score ───────────────────────────────────────────────────────
    let avgQuizScore: number | null = null;
    try {
      const { data: scores } = await supabaseAdmin
        .from("user_quiz_attempts").select("score").not("score", "is", null).limit(200);
      if (scores && scores.length > 0) {
        avgQuizScore = parseFloat((scores.reduce((a: number, c: any) => a + c.score, 0) / scores.length).toFixed(1));
      }
    } catch {}

    // ── Registrations by week (last 8 weeks) ────────────────────────────────
    const { data: recentUsers } = await supabaseAdmin
      .from("users")
      .select("created_at")
      .gte("created_at", eightWeeksAgo.toISOString());

    const weekCounts: Record<string, number> = {};
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const key = d.toISOString().split("T")[0];
      weekCounts[key] = 0;
    }
    (recentUsers || []).forEach(u => {
      const d = new Date(u.created_at);
      // Find which week bucket
      for (let i = 7; i >= 0; i--) {
        const bucketDate = new Date(now);
        bucketDate.setDate(bucketDate.getDate() - i * 7);
        const nextBucket = new Date(now);
        nextBucket.setDate(nextBucket.getDate() - (i - 1) * 7);
        if (d >= bucketDate && (i === 0 || d < nextBucket)) {
          weekCounts[bucketDate.toISOString().split("T")[0]]++;
          break;
        }
      }
    });

    const registrationsChart = Object.entries(weekCounts).map(([date, count]) => ({ date, count }));

    // ── Recent activity (multi-source) ───────────────────────────────────────
    const [{ data: recentRegistrations }, { data: recentPosts }, { data: recentAttempts }] = await Promise.all([
      supabaseAdmin.from("users").select("first_name, last_name, role, created_at").order("created_at", { ascending: false }).limit(4),
      supabaseAdmin.from("forum_posts").select("title, created_at, author:users(first_name, last_name)").order("created_at", { ascending: false }).limit(3),
      supabaseAdmin.from("user_exercise_attempts").select("created_at, user:users(first_name, last_name)").order("created_at", { ascending: false }).limit(3),
    ]);

    const activity = [
      ...(recentRegistrations || []).map(u => ({
        type: "inscription",
        icon: "user",
        description: `${u.first_name || "Utilisateur"} ${u.last_name || ""} s'est inscrit(e) en tant que ${u.role === "parent" ? "parent" : "élève"}`,
        timestamp: u.created_at,
      })),
      ...(recentPosts || []).map((p: any) => ({
        type: "forum",
        icon: "message",
        description: `${p.author?.first_name || "Quelqu'un"} a posté "${p.title}"`,
        timestamp: p.created_at,
      })),
      ...(recentAttempts || []).map((a: any) => ({
        type: "exercice",
        icon: "exercise",
        description: `${a.user?.first_name || "Un élève"} a fait un exercice`,
        timestamp: a.created_at,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);

    return NextResponse.json({
      stats: {
        total_users: totalUsers,
        total_parents: totalParents,
        total_children: totalChildren,
        new_today: newToday,
        new_this_week: newThisWeek,
        total_courses: totalCourses,
        total_exercises: totalExercises,
        total_quizzes: totalQuizzes,
        active_subs: activeSubs,
        forum_posts: forumPosts,
        forum_comments: forumComments,
        exercise_attempts: exerciseAttempts,
        course_progress: courseProgress,
        avg_quiz_score: avgQuizScore,
        parrainage_codes: parrainageCodes,
        parrainage_uses: parrainageUses,
      },
      charts: { registrations: registrationsChart },
      recent_activity: activity,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
