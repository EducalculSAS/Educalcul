import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";


// GET: Fetch all activities for the current user
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const authId = searchParams.get("userId"); // This is the auth.uid (UUID)

    if (!authId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    // Must find the internal BIGINT ID to filter correctly if needed
    const { data: userRecord } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", authId)
      .maybeSingle();

    if (!userRecord) {
      return NextResponse.json({ exercises: [], quizzes: [], courses: [] });
    }

    const internalId = userRecord.id;

    // Fetch Exercises History
    const { data: exercises, error: exError } = await supabaseAdmin
      .from("user_exercise_attempts")
      .select("*, exercises(title)")
      .eq("user_id", internalId)
      .order("completed_at", { ascending: false });

    // Fetch Quizzes History
    const { data: quizzes, error: qzError } = await supabaseAdmin
      .from("user_quiz_attempts")
      .select("*, quizzes(title)")
      .eq("user_id", internalId)
      .order("completed_at", { ascending: false });

    // Fetch Courses History
    const { data: courses, error: coError } = await supabaseAdmin
      .from("user_course_progress")
      .select("*, courses(title)")
      .eq("user_id", internalId)
      .order("completed_at", { ascending: false });

    if (exError || qzError || coError) {
      throw exError || qzError || coError;
    }

    return NextResponse.json({
      exercises: exercises || [],
      quizzes: quizzes || [],
      courses: courses || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Save a new activity
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, userId, itemId, score, totalPoints, timeSpent, chapterIndex, status } = body;

    if (!type || !userId || !itemId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Resolve Auth UUID to internal BIGINT ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", userId)
      .maybeSingle();

    if (userError || !userData) {
      throw new Error(userError?.message || "User record not found to associate activity.");
    }

    const internalId = userData.id;

    let result;
    if (type === "exercise") {
      result = await supabaseAdmin.from("user_exercise_attempts").upsert({
        user_id: internalId,
        exercise_id: itemId,
        score: score || 0,
        total_points: totalPoints || 0,
        status: status || 'in_progress',
        completed_at: new Date().toISOString()
      }, { onConflict: 'user_id, exercise_id' });
    } else if (type === "quiz") {
      result = await supabaseAdmin.from("user_quiz_attempts").upsert({
        user_id: internalId,
        quiz_id: itemId,
        score: score || 0,
        total_points: totalPoints || 0,
        time_spent_seconds: timeSpent || 0,
        status: status || 'in_progress',
        completed_at: new Date().toISOString()
      }, { onConflict: 'user_id, quiz_id' });
    } else if (type === "course") {
      result = await supabaseAdmin.from("user_course_progress").upsert({
        user_id: internalId,
        course_id: itemId,
        chapter_index: chapterIndex || 0,
        status: status || 'in_progress',
        completed_at: new Date().toISOString()
      }, { onConflict: 'user_id, course_id' });
    }

    if (result?.error) throw result.error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error saving activity:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
