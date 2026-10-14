import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";

const ALLOWED_CHOICES = ["1ere-generale", "1ere-generale-maths"];

// Choix de spécialité obligatoire pour un élève qui sort de Seconde après un
// passage de classe automatique (voir gradePromotionRun.ts) — c'est
// l'élève qui choisit à sa prochaine connexion, pas un adulte.
export async function POST(req: Request) {
  try {
    const me = await requireRole(req, ["child"]);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { choice } = await req.json();
    if (!ALLOWED_CHOICES.includes(choice)) {
      return NextResponse.json({ error: "Choix invalide" }, { status: 400 });
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, grade_level, needs_grade_choice")
      .eq("id", me.id)
      .maybeSingle();
    if (!user || !user.needs_grade_choice || user.grade_level !== "2nde") {
      return NextResponse.json({ error: "Aucun choix de niveau en attente." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update({ grade_level: choice, needs_grade_choice: false, specialties_chosen_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    return NextResponse.json({ success: true, gradeLevel: choice });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
