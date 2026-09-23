import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { runGradePromotion } from "@/lib/gradePromotionRun";

// Traitement par lots de tous les élèves : laisser le temps de finir.
export const maxDuration = 300;

const SETTINGS_KEY = "grade_promotion";

// Vérifié quotidiennement par Vercel Cron (voir vercel.json). Vercel signe la
// requête avec CRON_SECRET dans l'en-tête Authorization — toute autre requête
// est rejetée.
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  const config = { date: "09-01", lastRunYear: null as number | null, ...(data?.value || {}) };

  const now = new Date();
  const currentYear = now.getFullYear();
  const todayMD = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  if (config.lastRunYear === currentYear || todayMD < config.date) {
    return NextResponse.json({ ran: false, reason: config.lastRunYear === currentYear ? "already_run_this_year" : "not_due_yet" });
  }

  const result = await runGradePromotion();

  await supabaseAdmin
    .from("app_settings")
    .upsert({ key: SETTINGS_KEY, value: { ...config, lastRunYear: currentYear }, updated_at: new Date().toISOString() }, { onConflict: "key" });

  return NextResponse.json({ ran: true, ...result });
}
