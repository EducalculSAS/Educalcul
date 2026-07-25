import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";

// Droit à la portabilité (RGPD) : export JSON du compte parent et de ses enfants.
export async function GET(req: Request) {
  try {
    const me = await requireRole(req, ["parent"]);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: parent } = await supabaseAdmin
      .from("users")
      .select("first_name, last_name, email, created_at, grade_level, school_zone")
      .eq("id", me.id)
      .maybeSingle();

    const { data: children } = await supabaseAdmin
      .from("users")
      .select("first_name, last_name, email, child_username, grade_level, created_at")
      .eq("parent_id", me.id)
      .eq("role", "child");

    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("plan_id, status, current_period_end")
      .eq("user_id", me.authId)
      .maybeSingle();

    const json = JSON.stringify({ exported_at: new Date().toISOString(), parent, children: children || [], subscription: subscription || null }, null, 2);

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="educalcul-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
