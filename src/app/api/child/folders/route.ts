import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
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
      // Valide que parent_id est bien un entier (sinon Postgres renvoie une 500).
      const pid = Number(parentId);
      if (!Number.isInteger(pid)) {
        return NextResponse.json({ error: "Invalid parent_id" }, { status: 400 });
      }
      query = query.eq("parent_id", pid);
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
      
      // Le niveau de l'élève peut être stocké sous forme de CODE
      // ("1ere-generale-maths") ou de LIBELLÉ saisi à la main par un admin
      // ("Première (spé maths)"). On accepte donc une correspondance par
      // grade_level OU par nom du dossier (qui est le libellé).
      const lvl = level.toLowerCase().trim();
      const filteredData = data?.filter((folder) => {
        if (!folder.grade_level || folder.grade_level === "all") return true;
        const gl = String(folder.grade_level).toLowerCase().trim();
        const nm = String(folder.name || "").toLowerCase().trim();
        return gl === lvl || nm === lvl;
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
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
