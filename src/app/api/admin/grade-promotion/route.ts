import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { runGradePromotion, undoLastGradePromotion } from "@/lib/gradePromotionRun";
import { auditLog, AuditAction } from "@/lib/auditLog";

const SETTINGS_KEY = "grade_promotion";
const DATE_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/; // MM-DD

async function getConfig() {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  return { date: "09-01", lastRunYear: null as number | null, ...(data?.value || {}) };
}

export async function GET(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { data: lastRun } = await supabaseAdmin
    .from("grade_promotion_runs")
    .select("id, run_at, undone_at")
    .order("run_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ ...(await getConfig()), lastRun: lastRun || null });
}

export async function PUT(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { date } = await req.json();
  if (typeof date !== "string" || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "Format de date invalide (attendu MM-JJ)" }, { status: 400 });
  }

  const current = await getConfig();
  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert({ key: SETTINGS_KEY, value: { ...current, date }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

  return NextResponse.json({ success: true, date });
}

export async function POST(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const result = await runGradePromotion(admin.id);

  const current = await getConfig();
  await supabaseAdmin
    .from("app_settings")
    .upsert({ key: SETTINGS_KEY, value: { ...current, lastRunYear: new Date().getFullYear() }, updated_at: new Date().toISOString() }, { onConflict: "key" });

  await auditLog({
    action: AuditAction.USER_UPDATED,
    adminId: admin.id,
    targetType: "grade_promotion",
    details: result,
  }, req);

  return NextResponse.json({ success: true, ...result });
}

export async function DELETE(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const result = await undoLastGradePromotion();

    await auditLog({
      action: AuditAction.USER_UPDATED,
      adminId: admin.id,
      targetType: "grade_promotion_undo",
      details: result,
    }, req);

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 400 });
  }
}
