import { NextResponse } from "next/server";
import { requireRole, requireSuperAdmin } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { auditLog, AuditAction } from "@/lib/auditLog";
import { FEATURE_BY_KEY } from "@/lib/featureCatalog";
import { invalidateFeatureCache } from "@/lib/featureFlags";


/** État de chaque fonctionnalité du catalogue (absente en base = active). */
export async function GET(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const { data, error } = await supabaseAdmin.from("feature_flags").select("key, enabled, message, updated_at");
  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return NextResponse.json({ states: data ?? [] });
}

/**
 * Activer / couper une fonctionnalité du catalogue, avec un message
 * facultatif affiché aux utilisateurs. `{ action: "enable_all" }` rouvre tout.
 * Super admin uniquement ; journalisé.
 */
export async function PUT(req: Request) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return NextResponse.json({ error: "Réservé aux super admins" }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));

    if (body.action === "enable_all") {
      const { error } = await supabaseAdmin
        .from("feature_flags")
        .update({ enabled: true, updated_by: admin.id, updated_at: new Date().toISOString() })
        .eq("enabled", false);
      if (error) throw error;
      invalidateFeatureCache();
      await auditLog({ action: AuditAction.CONTENT_UPDATED, adminId: admin.id, targetType: "feature_flag", details: { action: "enable_all" } }, req).catch(() => {});
      return NextResponse.json({ success: true });
    }

    const key = typeof body.key === "string" ? body.key : "";
    if (!FEATURE_BY_KEY.has(key)) return NextResponse.json({ error: "Fonctionnalité inconnue" }, { status: 400 });
    if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "État invalide" }, { status: 400 });
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) || null : null;

    const { data, error } = await supabaseAdmin
      .from("feature_flags")
      .upsert(
        { key, enabled: body.enabled, message, updated_by: admin.id, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      )
      .select("key, enabled, message, updated_at")
      .single();
    if (error) throw error;

    invalidateFeatureCache();
    await auditLog(
      { action: AuditAction.CONTENT_UPDATED, adminId: admin.id, targetType: "feature_flag", details: { key, enabled: body.enabled } },
      req,
    ).catch(() => {});
    return NextResponse.json({ state: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err) || "Erreur interne") }, { status: 500 });
  }
}
