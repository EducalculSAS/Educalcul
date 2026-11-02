import { readJsonBody } from "@/lib/apiJson";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";

/** Édite le contenu d'un pack déjà généré (correction ponctuelle d'une
 * question) — l'admin n'intervient que sur le contenu, pas sur le
 * déclenchement de la génération quotidienne elle-même. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await readJsonBody(request);
  const questions = body?.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    return Response.json({ error: "Questions invalides." }, { status: 400 });
  }
  for (const q of questions) {
    if (typeof q?.prompt !== "string" || !q.prompt.trim() || !Number.isFinite(q?.answer)) {
      return Response.json({ error: "Chaque question doit avoir un énoncé et une réponse numérique." }, { status: 400 });
    }
  }

  const { error } = await supabaseAdmin
    .from("minigame_daily_sheets")
    .update({ questions, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return Response.json({ success: true });
}
