import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";

// Endpoint public : la sécurité repose sur le token à usage personnel envoyé
// par email (voir /api/parent/export-data), pas sur une session connectée —
// on veut que le lien fonctionne même depuis un autre appareil/navigateur.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Lien invalide" }, { status: 400 });

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { data: request } = await supabaseAdmin
      .from("data_export_requests")
      .select("id, user_id, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!request || new Date(request.expires_at) < new Date()) {
      return NextResponse.json({ error: "Ce lien a expiré. Refais une demande depuis ton profil." }, { status: 400 });
    }

    const { data: parent } = await supabaseAdmin
      .from("users")
      .select("auth_id, first_name, last_name, email, created_at, grade_level, school_zone")
      .eq("id", request.user_id)
      .maybeSingle();

    const { data: children } = await supabaseAdmin
      .from("users")
      .select("first_name, last_name, email, child_username, grade_level, created_at")
      .eq("parent_id", request.user_id)
      .eq("role", "child");

    const { data: subscription } = parent?.auth_id
      ? await supabaseAdmin
          .from("subscriptions")
          .select("plan_id, status, current_period_end")
          .eq("user_id", parent.auth_id)
          .maybeSingle()
      : { data: null };

    await supabaseAdmin.from("data_export_requests").update({ downloaded_at: new Date().toISOString() }).eq("id", request.id);

    const { auth_id: _authId, ...parentPublic } = parent || {};
    const json = JSON.stringify({ exported_at: new Date().toISOString(), parent: parentPublic, children: children || [], subscription: subscription || null }, null, 2);

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
