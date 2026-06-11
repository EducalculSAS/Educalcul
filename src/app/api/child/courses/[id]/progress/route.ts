import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

// GET: Fetch saved course progress (lessons completed, current position, status)
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
      return NextResponse.json({ progress: null, status: null });
    }

    const { data, error } = await supabaseAdmin
      .from("user_course_progress")
      .select("progress_json, chapter_index, status")
      .eq("user_id", userRecord.id)
      .eq("course_id", id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      progress: data?.progress_json || null,
      chapterIndex: data?.chapter_index ?? null,
      status: data?.status || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
