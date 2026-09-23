import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { applySpecialtyChoice, hasSpecialtyChoice } from "@/lib/specialties";

/**
 * Choix des spécialités par l'élève de Première ou de Terminale, une fois
 * (première connexion, ou après le passage en Terminale). Ensuite, seuls un
 * parent ou l'admin peuvent le modifier.
 */
export async function POST(req: Request) {
  try {
    const me = await requireRole(req, ["child"]);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, grade_level, extra_levels, specialties_chosen_at")
      .eq("id", me.id)
      .maybeSingle();
    if (!user || !hasSpecialtyChoice(user.grade_level)) {
      return NextResponse.json({ error: "Aucun choix de spécialités à faire." }, { status: 400 });
    }
    if (user.specialties_chosen_at) {
      return NextResponse.json({ error: "Tes spécialités sont déjà choisies : demande à ton parent pour les changer." }, { status: 409 });
    }

    const result = applySpecialtyChoice(user.grade_level, user.extra_levels, body?.track, body?.expertes);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("users")
      .update({ grade_level: result.gradeLevel, extra_levels: result.extraLevels, specialties_chosen_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    return NextResponse.json({ success: true, gradeLevel: result.gradeLevel, extraLevels: result.extraLevels });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
