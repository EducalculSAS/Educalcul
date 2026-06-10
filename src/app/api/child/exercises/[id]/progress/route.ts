import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

// GET: Fetch saved in-progress state (answers, results, feedback...) for an exercise
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const authId = searchParams.get("userId");
    if (!authId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    const { data: userRecord } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", authId)
      .maybeSingle();

    if (!userRecord) {
      return NextResponse.json({ progress: null });
    }

    const { data, error } = await supabaseAdmin
      .from("user_exercise_attempts")
      .select("progress_json, status")
      .eq("user_id", userRecord.id)
      .eq("exercise_id", id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ progress: data?.progress_json || null, status: data?.status || null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Save in-progress state for an exercise
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { userId, progress } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    const { data: userRecord, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", userId)
      .maybeSingle();

    if (userError || !userRecord) {
      throw new Error(userError?.message || "User record not found");
    }

    // Met à jour la progression sans écraser le score/statut d'une tentative déjà terminée
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("user_exercise_attempts")
      .update({ progress_json: progress })
      .eq("user_id", userRecord.id)
      .eq("exercise_id", id)
      .select("id");

    if (updateError) throw updateError;

    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabaseAdmin
        .from("user_exercise_attempts")
        .insert({
          user_id: userRecord.id,
          exercise_id: id,
          progress_json: progress,
          score: 0,
          total_points: 0,
          status: "in_progress",
        });
      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
