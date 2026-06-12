import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";

/**
 * GET /api/admin/users-list
 * Returns a list of all users (emails, names, roles)
 * ✓ CRITICAL FIX: Admin-only endpoint (was missing authentication!)
 */
export async function GET(req: Request) {
  // ✓ CRITICAL FIX: Require admin authentication
  const admin = await requireRole(req, ["admin"]);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, auth_id, email, first_name, last_name, role")
      .order("first_name");
    
    if (error) {
      console.error("[users-list] Database error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    
    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error("[users-list] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
