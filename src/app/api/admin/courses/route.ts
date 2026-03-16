import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Initialize Supabase Admin Client
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

    if (id) {
      const { data, error } = await supabaseAdmin
        .from("courses")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    let query = supabaseAdmin
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching courses:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      subject,
      level,
      status,
      thumbnail_url,
      folder_id,
      content_json,
    } = body;

    const { data, error } = await supabaseAdmin
      .from("courses")
      .insert({
        title,
        description,
        subject,
        level: level || "6eme",
        status: status || "draft",
        thumbnail_url,
        folder_id: folder_id || null,
        content_json: content_json || [],
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, course: data });
  } catch (error: any) {
    console.error("Error creating course:", error);
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
      subject,
      level,
      status,
      thumbnail_url,
      folder_id,
      content_json,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Course ID is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("courses")
      .update({
        title,
        description,
        subject,
        level,
        status,
        thumbnail_url,
        folder_id: folder_id || null,
        content_json: content_json || [],
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, course: data });
  } catch (error: any) {
    console.error("Error updating course:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Course ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("courses").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
