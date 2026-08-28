import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";

/**
 * Mise à jour des champs de profil que l'utilisateur peut modifier LUI-MÊME
 * sur son propre compte. Avant, ces `update` partaient directement du
 * navigateur (`supabase.from("users").update(...)`) en s'appuyant sur la RLS.
 *
 * Allowlist STRICTE : tout champ hors de cette liste est ignoré silencieusement
 * — impossible de toucher `role`, `parent_id`, `status`, `two_factor_enabled`,
 * `grade_level`, etc. depuis ici.
 */
/** Champs du profil que l'utilisateur peut lire sur lui-même (jamais les
 * colonnes sensibles : parent_id, ban_reason, stripe ids, hash divers…). */
const READABLE = "id, first_name, last_name, email, avatar, role, grade_level, child_username, onboarding_completed, two_factor_enabled, two_factor_locked_by_parent, notif_weekly_reports, notif_offers_news";

export async function GET(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const { data, error } = await supabaseAdmin
      .from("users")
      .select(READABLE)
      .eq("id", me.id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err?.message || "Erreur interne") }, { status: 500 });
  }
}

const STRING_FIELDS = new Set(["avatar", "first_name", "last_name"]);
const BOOL_FIELDS = new Set([
  "notif_weekly_reports",
  "notif_offers_news",
  "onboarding_completed",
]);

export async function PATCH(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(body)) {
      if (STRING_FIELDS.has(k) && typeof v === "string" && v.trim().length <= 255) patch[k] = v.trim();
      else if (BOOL_FIELDS.has(k) && typeof v === "boolean") patch[k] = v;
    }

    // L'acceptation des CGU n'est horodatée que par le serveur, au moment où
    // l'onboarding est marqué terminé (jamais une date fournie par le client).
    if (patch.onboarding_completed === true) {
      patch.cgu_accepted_at = new Date().toISOString();
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Aucun champ modifiable fourni" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("users").update(patch).eq("id", me.id);
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[user/profile] error:", err);
    return NextResponse.json({ error: sanitizeErrorMessage(err?.message || "Erreur interne") }, { status: 500 });
  }
}
