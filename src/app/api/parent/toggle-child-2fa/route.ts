import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";

// La 2FA d'un compte enfant est gérée par le parent, pas par l'enfant
// lui-même (aucun code de vérification requis ici — le parent est déjà
// authentifié et n'agit que sur ses propres enfants).
export async function POST(req: Request) {
  try {
    const parent = await requireRole(req, ["parent"]);
    if (!parent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { childId } = await req.json();
    if (!childId) return NextResponse.json({ error: "childId manquant" }, { status: 400 });

    const { data: child } = await supabaseAdmin
      .from("users")
      .select("id, two_factor_enabled")
      .eq("id", childId)
      .eq("parent_id", parent.id)
      .eq("role", "child")
      .maybeSingle();
    if (!child) return NextResponse.json({ error: "Enfant introuvable" }, { status: 404 });

    const enabled = !child.two_factor_enabled;
    const { error } = await supabaseAdmin.from("users").update({ two_factor_enabled: enabled }).eq("id", child.id);
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    return NextResponse.json({ success: true, enabled });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
