import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Helper to safely get count, returning 0 if table doesn't exist or error
async function safeGetCount(table: string, query?: (q: any) => any) {
  try {
    let builder = supabaseAdmin.from(table).select("*", { count: "exact", head: true });
    if (query) {
      builder = query(builder);
    }
    const { count, error } = await builder;
    if (error) return 0;
    return count || 0;
  } catch (e) {
    return 0;
  }
}

export async function GET() {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();

    // 1. Basic Counts (Parallel)
    const [
      totalUsers,
      totalParents,
      totalChildren,
      newUsersToday,
      totalCourses,
      totalExercises,
      totalQuizzes,
      forumTopics,
      forumPosts,
      activeSubscribers,
    ] = await Promise.all([
      safeGetCount("users"),
      safeGetCount("users", (q) => q.eq("role", "parent")),
      safeGetCount("users", (q) => q.eq("role", "child")),
      safeGetCount("users", (q) => q.gte("created_at", todayStart)),
      safeGetCount("courses", (q) => q.eq("status", "published")),
      safeGetCount("exercises", (q) => q.eq("status", "published")),
      safeGetCount("quizzes", (q) => q.eq("status", "published")),
      safeGetCount("forum_topics"),
      safeGetCount("forum_posts"),
      safeGetCount("users", (q) => q.eq("subscription_status", "active")),
    ]);

    // 2. Charts Data (Registrations last 30 days)
    const { data: usersLast30Days } = await supabaseAdmin
      .from("users")
      .select("created_at")
      .gte("created_at", thirtyDaysAgo);
    
    const registrationsChart = processRegistrationsChart(usersLast30Days || []);

    // 3. Recent Activity (Last 5 users)
    const { data: recentUsers } = await supabaseAdmin
      .from("users")
      .select("first_name, last_name, created_at, role")
      .order("created_at", { ascending: false })
      .limit(5);

    // 4. Advanced Metrics (Real Data Only)
    
    // Conversion Rate
    const conversionRate = totalUsers > 0 ? (activeSubscribers / totalUsers) * 100 : 0;

    // Avg Quiz Score
    let avgQuizScore = 0;
    try {
      const { data: quizScores, error } = await supabaseAdmin
        .from("user_quiz_attempts")
        .select("score")
        .limit(100);
      
      if (!error && quizScores && quizScores.length > 0) {
        const totalScore = quizScores.reduce((acc, curr) => acc + (curr.score || 0), 0);
        avgQuizScore = totalScore / quizScores.length;
      }
    } catch (e) {
      // Table might not exist
    }

    // Completion Rate (attempts vs completions if available, otherwise 0)
    // We assume 'user_progress' table might track this. If not, 0.
    let completionRate = 0;
    try {
        // Example logic: if we had a progress table
        // const completed = await safeGetCount('user_progress', q => q.eq('status', 'completed'));
        // const started = await safeGetCount('user_progress');
        // completionRate = started > 0 ? (completed / started) * 100 : 0;
    } catch(e) {}


    // We explicitly set unavailable metrics to 0 or null instead of fake values
    const avgSessionDuration = 0; // Not tracked
    const bounceRate = 0; // Not tracked
    const retentionRate7d = 0; // Not tracked
    const retentionRate30d = 0; // Not tracked

    return NextResponse.json({
      stats: {
        total_users: totalUsers,
        total_parents: totalParents,
        total_children: totalChildren,
        new_registrations_today: newUsersToday,
        total_courses: totalCourses,
        total_exercises: totalExercises,
        total_quizzes: totalQuizzes,
        forum_topics: forumTopics,
        forum_posts: forumPosts,

        // Advanced metrics
        conversion_rate: parseFloat(conversionRate.toFixed(1)),
        avg_session_duration: avgSessionDuration,
        bounce_rate: bounceRate,
        retention_rate_7d: retentionRate7d,
        retention_rate_30d: retentionRate30d,
        completion_rate: completionRate,
        avg_quiz_score: parseFloat(avgQuizScore.toFixed(1)),
      },
      charts: {
        registrations: registrationsChart,
      },
      recent_activity: recentUsers?.map((u) => ({
        type: "inscription",
        description: `${u.first_name || 'Utilisateur'} ${u.last_name || ''}`,
        timestamp: u.created_at,
      })) || [],
    });
  } catch (error: any) {
    console.error("Reports API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function processRegistrationsChart(data: any[]) {
  const counts: Record<string, number> = {};
  
  // Initialize last 30 days with 0
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    counts[dateStr] = 0;
  }

  // Fill with real data
  data.forEach((item) => {
    const date = item.created_at.split("T")[0];
    if (counts[date] !== undefined) {
      counts[date]++;
    }
  });

  return Object.entries(counts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));
}
