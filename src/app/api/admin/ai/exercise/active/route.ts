import { requireRole } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { reconcileStaleGenerations } from "@/lib/ai/runtime";

export async function GET(request: Request) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await reconcileStaleGenerations("content_generations", "exercise");

  const { data, error } = await supabaseAdmin
    .from("content_generations")
    .select("id, status, progress, exercise_id:target_id, error, params, created_at")
    .eq("kind", "exercise")
    .eq("admin_id", admin.id)
    .in("status", ["pending", "running", "cancel_requested", "done", "error", "cancelled"])
    // Les exercices d'un lot ont leur propre suivi (fenêtre « Génération par lots ») : les afficher aussi dans le
    // panneau des générations le noyait, et le fermer supprimait leur suivi.
    .is("params->>batchId", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return Response.json(data || []);
}
