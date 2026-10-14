import { NextResponse } from "next/server";
import { selectAllPages } from "@/lib/selectAllPages";
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
    // Paginé : un select plafonne silencieusement à 1000 lignes.
    const data = await selectAllPages((from, to) =>
      supabaseAdmin
        .from("users")
        .select("id, auth_id, email, first_name, last_name, role")
        .order("first_name")
        .order("id")
        .range(from, to),
    );
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("[users-list] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
