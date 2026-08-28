import { requireRole } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { reconcileStaleGenerations } from "@/lib/ai/runtime";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await reconcileStaleGenerations("content_generations", "exercise");
  const { data, error } = await supabaseAdmin
    .from("content_generations")
    .select("id, status, progress, exercise_id:target_id, error, params, created_at")
    .eq("id", id)
    .eq("admin_id", admin.id)
    .maybeSingle();

  if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  if (!data) return Response.json({ error: "Introuvable" }, { status: 404 });
  return Response.json(data);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data: existing } = await supabaseAdmin
    .from("content_generations")
    .select("status")
    .eq("id", id)
    .eq("admin_id", admin.id)
    .maybeSingle();

  if (!existing) return Response.json({ error: "Introuvable" }, { status: 404 });
  if (!["pending", "running"].includes(existing.status)) {
    return Response.json({ success: true, alreadyFinished: true });
  }

  const { error } = await supabaseAdmin
    .from("content_generations")
    .update({ status: "cancel_requested", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return Response.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error } = await supabaseAdmin
    .from("content_generations")
    .delete()
    .eq("id", id)
    .eq("admin_id", admin.id);

  if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return Response.json({ success: true });
}
