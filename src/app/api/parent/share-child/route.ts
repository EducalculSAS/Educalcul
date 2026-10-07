import { NextResponse } from "next/server";
import { canActOnInternalId, getAuthenticatedUser } from "@/lib/apiAuth";
import { createShareToken, revokeShareTokens } from "@/lib/shareToken";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSiteUrl } from "@/lib/siteUrl";
import { sanitizeErrorMessage } from "@/lib/safeError";

/** Lien de suivi en lecture seule pour un second adulte ou un répétiteur (30 jours), ou révocation de tous les liens. */
export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (me.role !== "parent") return NextResponse.json({ error: "Réservé aux parents." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const childId = Number(body.childId);
    if (!(await canActOnInternalId(me, childId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { data: child } = await supabaseAdmin.from("users").select("id, role, parent_id").eq("id", childId).maybeSingle();
    if (!child || child.role !== "child" || child.parent_id !== me.id) return NextResponse.json({ error: "Enfant introuvable." }, { status: 404 });

    if (body.action === "revoke") {
      await revokeShareTokens(childId);
      return NextResponse.json({ success: true });
    }
    const { token, expiresAt } = await createShareToken(childId);
    return NextResponse.json({ url: `${getSiteUrl()}/suivi/${encodeURIComponent(token)}`, expiresAt });
  } catch (error) {
    return NextResponse.json({ error: sanitizeErrorMessage(error instanceof Error ? error.message : "Erreur interne") }, { status: 500 });
  }
}
