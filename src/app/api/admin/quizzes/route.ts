import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const id = searchParams.get("id");
    const courseId = searchParams.get("course_id");

    if (id) {
      const { data, error } = await supabaseAdmin
        .from("quizzes")
        .select(`
          *,
          courses (title),
          quiz_folders (name, color)
        `)
        .eq("id", id)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json(data);
    }

    let query = supabaseAdmin
      .from("quizzes")
      .select(
        `
        *,
        courses (title),
        quiz_folders (name, color)
      `
      )
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (courseId && courseId !== "all") {
      query = query.eq("course_id", courseId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching quizzes:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      course_id,
      time_limit_minutes,
      status,
      folder_id,
      thumbnail_filename,
      content_json,
      type,
      difficulty_level,
      level,
      max_attempts,
      grading_type,
      estimated_time,
    } = body;

    const { data, error } = await supabaseAdmin
      .from("quizzes")
      .insert({
        title,
        description, // or question?
        course_id,
        time_limit_minutes,
        status: status || "draft",
        folder_id: folder_id || null,
        thumbnail_filename,
        content_json,
        type: type || "standard",
        level: level || "6eme",
        difficulty_level: difficulty_level || "medium",
        max_attempts: max_attempts || 0,
        grading_type: grading_type || "auto",
        estimated_time: estimated_time ?? 15,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, quiz: data });
  } catch (error: any) {
    console.error("Error creating quiz:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      title,
      description,
      course_id,
      time_limit_minutes,
      status,
      folder_id,
      thumbnail_filename,
      content_json,
      type,
      difficulty_level,
      level,
      max_attempts,
      grading_type,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Quiz ID is required" },
        { status: 400 }
      );
    }

    // Build a partial update: only include fields whose keys are present in the body.
    // This prevents a folder move ({ id, folder_id }) from wiping title/content/etc.
    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
    if (has("title")) updatePayload.title = title;
    if (has("description")) updatePayload.description = description;
    if (has("course_id")) updatePayload.course_id = course_id || null;
    if (has("time_limit_minutes")) updatePayload.time_limit_minutes = time_limit_minutes;
    if (has("min_score_percent")) updatePayload.min_score_percent = body.min_score_percent || null;
    if (has("status")) updatePayload.status = status;
    if (has("folder_id")) updatePayload.folder_id = folder_id || null;
    if (has("thumbnail_filename")) updatePayload.thumbnail_filename = thumbnail_filename;
    if (has("content_json")) updatePayload.content_json = content_json;
    if (has("type")) updatePayload.type = type;
    if (has("difficulty_level")) updatePayload.difficulty_level = difficulty_level;
    if (has("level")) updatePayload.level = level;
    if (has("estimated_time")) updatePayload.estimated_time = body.estimated_time ?? 15;
    if (has("max_attempts")) updatePayload.max_attempts = max_attempts;
    if (has("grading_type")) updatePayload.grading_type = grading_type;

    const { data, error } = await supabaseAdmin
      .from("quizzes")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, quiz: data });
  } catch (error: any) {
    console.error("Error updating quiz:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Quiz ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("quizzes").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
