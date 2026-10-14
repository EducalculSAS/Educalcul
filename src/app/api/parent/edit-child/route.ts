import { sanitizeAvatar } from "@/lib/avatarUrl";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser, canActOnInternalId } from "@/lib/apiAuth";
import { isValidEmail } from "@/lib/validation";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { applySpecialtyChoice } from "@/lib/specialties";

/** Édite les champs de profil d'un enfant (le changement d'email/mot de passe
 * côté Auth reste géré par /api/update-child-auth). Avant : `supabase.from
 * ("users").update()` depuis EditChildForm, RLS-only. */
export async function PATCH(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (me.role !== "parent" && me.role !== "admin") {
      return NextResponse.json({ error: "Interdit" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const childId = Number(body.childId);
    if (!Number.isFinite(childId)) {
      return NextResponse.json({ error: "childId invalide" }, { status: 400 });
    }
    if (!(await canActOnInternalId(me, childId))) {
      return NextResponse.json({ error: "Interdit" }, { status: 403 });
    }

    const patch: Record<string, unknown> = {};
    for (const k of ["first_name", "last_name", "child_username"] as const) {
      if (typeof body[k] === "string") patch[k] = body[k].trim();
    }
    if (body.avatar !== undefined) {
      const avatar = sanitizeAvatar(body.avatar);
      if (avatar === null) return NextResponse.json({ error: "Avatar invalide" }, { status: 400 });
      patch.avatar = avatar;
    }
    if (typeof body.email === "string") {
      if (!isValidEmail(body.email.trim())) {
        return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
      }
      patch.email = body.email.trim();
    }
    // Voie en maths au lycée (Première / Terminale, option maths expertes) :
    // mêmes règles que le choix fait par l'élève (voir specialties.ts).
    if (body.specialties && typeof body.specialties === "object") {
      const { data: child } = await supabaseAdmin.from("users").select("grade_level, extra_levels").eq("id", childId).maybeSingle();
      const result = applySpecialtyChoice(child?.grade_level, child?.extra_levels, body.specialties.track, body.specialties.expertes);
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
      patch.grade_level = result.gradeLevel;
      patch.extra_levels = result.extraLevels;
      patch.specialties_chosen_at = new Date().toISOString();
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400 });
    }

    // Unicité username.
    if (typeof patch.child_username === "string" && patch.child_username) {
      const { data: taken } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("child_username", patch.child_username)
        .neq("id", childId)
        .maybeSingle();
      if (taken) return NextResponse.json({ error: "Ce nom d'utilisateur est déjà pris." }, { status: 409 });
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update(patch)
      .eq("id", childId)
      .eq("role", "child");
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[edit-child] error:", err);
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err) || "Erreur interne") }, { status: 500 });
  }
}
