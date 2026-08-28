import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";

/** Enregistre la config d'un clavier mathématique. Avant : `supabase.from
 * ("math_keyboards").update()` depuis AdminKeyboardsClient (RLS-only). */
export async function PATCH(req: Request) {
  try {
    if (!(await requireRole(req, ["admin"]))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id, config } = await req.json().catch(() => ({}));
    if (!Number.isFinite(Number(id)) || typeof config !== "object" || config === null) {
      return NextResponse.json({ error: "id / config invalide" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("math_keyboards")
      .update({ config, updated_at: new Date().toISOString() })
      .eq("id", Number(id));
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
