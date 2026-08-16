import { requireRole } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { reconcileStaleGenerations } from "@/lib/ai/runtime";

/** Statut + progression d'une génération en cours (ou terminée). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await reconcileStaleGenerations("course_generations");
  const { data, error } = await supabaseAdmin
    .from("course_generations")
    .select("id, status, progress, course_id, error, params, created_at")
    .eq("id", id)
    .eq("admin_id", admin.id)
    .maybeSingle();

  if (error) {
    return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
  if (!data) return Response.json({ error: "Introuvable" }, { status: 404 });

  return Response.json(data);
}

/** Demande d'annulation : la génération s'arrête au prochain appel IA prévu. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data: existing } = await supabaseAdmin
    .from("course_generations")
    .select("status")
    .eq("id", id)
    .eq("admin_id", admin.id)
    .maybeSingle();

  if (!existing) return Response.json({ error: "Introuvable" }, { status: 404 });
  if (!["pending", "running"].includes(existing.status)) {
    return Response.json({ success: true, alreadyFinished: true });
  }

  const { error } = await supabaseAdmin
    .from("course_generations")
    .update({ status: "cancel_requested", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
  return Response.json({ success: true });
}

/**
 * Retire une génération de la liste (widget) — supprime uniquement la ligne
 * de suivi, jamais le cours déjà créé. Sans ça, un rechargement de page
 * ré-affiche systématiquement une génération "retirée" côté client, puisque
 * /active la retrouverait toujours en base.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error } = await supabaseAdmin
    .from("course_generations")
    .delete()
    .eq("id", id)
    .eq("admin_id", admin.id);

  if (error) {
    return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
  return Response.json({ success: true });
}
