import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser, canActOnAuthId } from "@/lib/apiAuth";

// GET: Fetch saved course progress (lessons completed, current position, status)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const authId = searchParams.get("userId");
    if (!authId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }
    if (!(await canActOnAuthId(me, authId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
