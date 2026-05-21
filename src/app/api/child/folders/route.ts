import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 'exercise', 'course', 'quiz'
    const level = searchParams.get("level");
    const parentId = searchParams.get("parent_id"); // optional, for navigating subfolders

    if (!type || !["exercise", "course", "quiz"].includes(type)) {
      return NextResponse.json(
        { error: "Valid type (exercise, course, quiz) is required" },
        { status: 400 }
      );
    }

    const tableName = `${type}_folders`;

    let query = supabaseAdmin
      .from(tableName)
      .select("*")
      .eq("status", "published")
      .order("name");

    // Top level folders, subfolders, or ALL
    if (parentId === "all") {
      // Do nothing, fetch all folders
    } else if (parentId && parentId !== "null") {
      query = query.eq("parent_id", Number(parentId));
    } else {
      query = query.is("parent_id", null);
    }

    // Filter by grade level (matching exact or "all")
    if (level) {
      // We want folders where grade_level is 'all' or matches the child's level (case-insensitive)
      // Supabase supports .or() or .ilike() but filtering client-side or simply using .ilike()
      // Let's fetch both or just use an exact match
      // For simplicity, let's fetch 'published' ones and filter by level in the API logic
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const filteredData = data?.filter((folder) => {
        if (!folder.grade_level || folder.grade_level === "all") return true;
        return folder.grade_level.toLowerCase() === level.toLowerCase();
      });

      return NextResponse.json(filteredData);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Error fetching folders:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
