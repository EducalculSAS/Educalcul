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

    const { data, error } = await supabaseAdmin
      .from("quizzes")
      .update({
        title,
        description,
        course_id,
        time_limit_minutes,
        status,
        folder_id: folder_id || null,
        thumbnail_filename,
        content_json,
        type,
        difficulty_level,
        level,
        max_attempts,
        grading_type,
        updated_at: new Date().toISOString(),
      })
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
