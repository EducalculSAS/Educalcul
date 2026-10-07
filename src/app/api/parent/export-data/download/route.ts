import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { exportUserData } from "@/lib/userData";

// Endpoint public : la sécurité repose sur le token à usage personnel envoyé
// par email (voir /api/parent/export-data), pas sur une session connectée —
// on veut que le lien fonctionne même depuis un autre appareil/navigateur.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Lien invalide" }, { status: 400 });

    const tokenHash = createHash("sha256").update(token).digest("hex");
    // Marque le token comme utilisé atomiquement (évite qu'un double-clic ou
    // une requête dupliquée ne passe deux fois avant l'écriture).
    const { data: claimed } = await supabaseAdmin
      .from("data_export_requests")
      .update({ downloaded_at: new Date().toISOString() })
      .eq("token_hash", tokenHash)
      .is("downloaded_at", null)
      .select("id, user_id, expires_at")
      .maybeSingle();

    if (!claimed || new Date(claimed.expires_at) < new Date()) {
      return NextResponse.json({ error: "Ce lien est invalide, a déjà été utilisé, ou a expiré. Refais une demande depuis ton profil." }, { status: 400 });
    }
    const request = claimed;

    const { data: parent } = await supabaseAdmin
      .from("users")
      .select("auth_id, first_name, last_name, email, created_at, grade_level, school_zone")
      .eq("id", request.user_id)
      .maybeSingle();

    const { data: children } = await supabaseAdmin
      .from("users")
      .select("id, first_name, last_name, email, child_username, grade_level, created_at")
      .eq("parent_id", request.user_id)
      .eq("role", "child");

    const { data: subscription } = parent?.auth_id
      ? await supabaseAdmin
          .from("subscriptions")
          .select("plan_id, status, current_period_end")
          .eq("user_id", parent.auth_id)
          .maybeSingle()
      : { data: null };

    // Profil pedagogique Calia (droit a la portabilite) — une ligne par
    // enfant, jointe manuellement plutot que via un select imbrique pour
    // rester simple (peu d'enfants par foyer).
    const childrenWithProfile = await Promise.all(
      (children || []).map(async ({ id, ...child }) => {
        const { data: profile } = await supabaseAdmin
          .from("calia_student_profile")
          .select("mastered_notions, weak_notions, preferred_method, behavior_notes, last_summary, updated_at")
          .eq("user_id", id)
          .maybeSingle();
        return { ...child, calia_learning_profile: profile || null, objectifs_revisions_et_alertes: await exportUserData(id) };
      }),
    );

    const parentSettings = await exportUserData(request.user_id);
    const { auth_id: _authId, ...parentPublic } = parent || {};
    const json = JSON.stringify({ exported_at: new Date().toISOString(), parent: { ...parentPublic, reglages_alertes: parentSettings }, children: childrenWithProfile, subscription: subscription || null }, null, 2);

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
