import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { auditLog, AuditAction } from "@/lib/auditLog";
import { invalidateCatalog } from "@/lib/catalogCache";

/**
 * Enregistre l'ordre des cours d'un dossier, tel que l'admin l'a arrangé.
 * Corps : { orderedIds: string[] } — les cours du dossier, dans l'ordre voulu.
 *
 * `chapter_order` reçoit (rang + 1) × 10 : le tri n'a lieu qu'à l'intérieur
 * d'un dossier, et l'écart laisse la place d'insérer un cours plus tard sans
 * renuméroter les autres. Le catalogue élève trie sur cette même colonne.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const ids: unknown = body.orderedIds;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) {
      return NextResponse.json({ error: "orderedIds invalide" }, { status: 400 });
    }
    // Uniquement des identifiants numériques, sans doublon.
    const clean = ids.map(String);
    if (clean.some((id) => !/^\d{1,12}$/.test(id)) || new Set(clean).size !== clean.length) {
      return NextResponse.json({ error: "orderedIds invalide" }, { status: 400 });
    }

    // Les cours d'une même réorganisation doivent appartenir au même dossier :
    // sinon un appel mal formé mélangerait l'ordre de plusieurs dossiers.
    const { data: rows, error: readError } = await supabaseAdmin
      .from("courses")
      .select("id, folder_id")
      .in("id", clean);
    if (readError) throw readError;
    if (!rows || rows.length !== clean.length) {
      return NextResponse.json({ error: "Cours introuvable" }, { status: 404 });
    }
    if (new Set(rows.map((r) => r.folder_id ?? "root")).size > 1) {
      return NextResponse.json({ error: "Les cours doivent appartenir au même dossier" }, { status: 400 });
    }

    const results = await Promise.all(
      clean.map((id, index) =>
        supabaseAdmin.from("courses").update({ chapter_order: (index + 1) * 10 }).eq("id", id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
    invalidateCatalog();

    await auditLog(
      { action: AuditAction.CONTENT_UPDATED, adminId: admin.id, details: { reorder: "courses", count: clean.length } },
      req,
    ).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error) || "Erreur interne") }, { status: 500 });
  }
}
