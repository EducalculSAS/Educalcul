import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { generateBackupCodes } from "@/lib/totp";
import { hashTwoFactorValue } from "@/lib/twoFactor";

// Nécessite une session 2FA déjà valide (requireRole applique le gate TOTP
// complet) — on ne régénère pas des codes de secours sans être déjà connecté.
export async function GET(req: Request) {
  const me = await requireRole(req, ["admin"]);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count } = await supabaseAdmin
    .from("two_factor_backup_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", me.id)
    .is("used_at", null);

  return NextResponse.json({ remaining: count || 0 });
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, ["admin"]);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Invalide tous les anciens codes non utilisés avant d'en générer de nouveaux.
    await supabaseAdmin.from("two_factor_backup_codes").delete().eq("user_id", me.id).is("used_at", null);

    const backupCodes = generateBackupCodes();
    const { error } = await supabaseAdmin.from("two_factor_backup_codes").insert(
      backupCodes.map(code => ({ user_id: me.id, code_hash: hashTwoFactorValue(code) }))
    );
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    return NextResponse.json({ success: true, backupCodes });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
