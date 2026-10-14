import { requireRole } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";

/** Aperçu admin (cours/exercice/quiz non encore enregistré) — transmis à
 * l'onglet ouvert par window.open via une ligne DB temporaire au lieu de
 * localStorage. Ne garde qu'un aperçu par admin+type : un nouvel aperçu
 * remplace l'ancien, pas besoin de purge planifiée. */
export async function POST(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const { type, payload } = await req.json();
    if (!["course", "exercise", "quiz"].includes(type)) {
      return Response.json({ error: "type invalide" }, { status: 400 });
    }

    await supabaseAdmin.from("content_previews").delete().eq("admin_id", admin.id).eq("type", type);

    const { data, error } = await supabaseAdmin
      .from("content_previews")
      .insert({ admin_id: admin.id, type, payload })
      .select("id")
      .single();

    if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
    return Response.json({ id: data.id });
  } catch (err: unknown) {
    return Response.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
