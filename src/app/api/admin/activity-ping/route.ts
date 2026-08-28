import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";

/** Marque l'admin connecté comme actif maintenant (présence dans la console
 * admin). Avant : `supabase.from("users").update({ last_active_at })` depuis le
 * navigateur. */
export async function POST(req: Request) {
  const me = await requireRole(req, ["admin"]);
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await supabaseAdmin
    .from("users")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", me.id);

  return NextResponse.json({ success: true });
}
