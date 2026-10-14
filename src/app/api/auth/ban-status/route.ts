import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthIdentityOnly } from "@/lib/apiAuth";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";

/** Statut de bannissement du compte connecté — SANS le gate "compte banni" de
 * getAuthenticatedUser (sinon un banni ne pourrait pas afficher la raison sur
 * /auth/banned). Lu par BannedClient. */
export async function GET(req: Request) {
  try {
    const identity = await getAuthIdentityOnly(req);
    if (!identity) return NextResponse.json({ banned: false }, { status: 401 });

    const { data } = await supabaseAdmin
      .from("users")
      .select("status, first_name, last_name, ban_reason, ban_until")
      .eq("auth_id", identity.authId)
      .maybeSingle();

    if (!data) return NextResponse.json({ banned: false });
    const banned = data.status === "inactive" || !!data.ban_reason;
    return NextResponse.json({
      banned,
      first_name: data.first_name,
      last_name: data.last_name,
      ban_reason: data.ban_reason,
      ban_until: data.ban_until,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err) || "Erreur interne") }, { status: 500 });
  }
}
