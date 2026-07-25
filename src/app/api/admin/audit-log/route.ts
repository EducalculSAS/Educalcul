import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";

export async function GET(req: Request) {
  try {
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = 50;
    const action = searchParams.get("action");

    let query = supabaseAdmin
      .from("audit_logs")
      .select("id, action, admin_id, target_user_id, target_type, target_id, details, ip_address, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (action) query = query.eq("action", action);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    const adminIds = Array.from(new Set((data || []).map(d => d.admin_id).filter(Boolean)));
    const targetIds = Array.from(new Set((data || []).map(d => d.target_user_id).filter(Boolean)));
    const allIds = Array.from(new Set([...adminIds, ...targetIds]));
    const { data: users } = allIds.length
      ? await supabaseAdmin.from("users").select("id, first_name, last_name, email").in("id", allIds)
      : { data: [] as any[] };
    const usersById = Object.fromEntries((users || []).map(u => [u.id, u]));

    const entries = (data || []).map(d => ({
      ...d,
      admin: usersById[d.admin_id] || null,
      target: d.target_user_id ? usersById[d.target_user_id] || null : null,
    }));

    return NextResponse.json({ entries, page, pageSize, total: count || 0 });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
