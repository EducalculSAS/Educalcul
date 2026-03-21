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
        .from("exercises")
        .select(`
          *,
          courses (title),
          exercise_folders (name, color)
        `)
        .eq("id", id)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json(data);
    }

    let query = supabaseAdmin
      .from("exercises")
      .select(
        `
        *,
        courses (title),
        exercise_folders (name, color)
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
    console.error("Error fetching exercises:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      description, // Maps to 'question' column likely
      course_id,
      difficulty_level,
      type,
      level,
      status,
      folder_id,
      thumbnail_url,
      content_json,
      time_limit,
      max_attempts,
    } = body;

    const { data, error } = await supabaseAdmin
      .from("exercises")
      .insert({
        title,
        question: description, // Mapping description to question column
        course_id,
        difficulty_level,
        type,
        level: level || "6eme",
        status: status || "draft",
        is_published: status === "published" || status === "active",
        folder_id: folder_id || null,
        thumbnail_url,
        content_json,
        time_limit: time_limit || null,
        max_attempts: max_attempts || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, exercise: data });
  } catch (error: any) {
    console.error("Error creating exercise:", error);
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
      difficulty_level,
      type,
      level,
      status,
      folder_id,
      thumbnail_url,
      content_json,
      time_limit,
      max_attempts,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Exercise ID is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("exercises")
      .update({
        title,
        question: description,
        course_id,
        difficulty_level,
        type,
        level,
        status,
        is_published: status === "published" || status === "active",
        folder_id: folder_id || null,
        thumbnail_url,
        content_json,
        time_limit: time_limit || null,
        max_attempts: max_attempts || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, exercise: data });
  } catch (error: any) {
    console.error("Error updating exercise:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Exercise ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("exercises")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
