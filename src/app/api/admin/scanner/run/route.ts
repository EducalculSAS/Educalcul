import { getClientIp } from "@/lib/apiAuth";
import { after } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getScanCategory } from "@/lib/scanner/categories";
import { runScan } from "@/lib/scanner/runScan";

// Plafond de sécurité — le vrai travail tourne via after() après la réponse
// HTTP, ce plafond couvre la fenêtre où Vercel maintient la fonction active
// (même patron que /api/admin/ai/course).
export const maxDuration = 300;

/**
 * Démarre un scan IA en ARRIÈRE-PLAN : crée immédiatement une ligne
 * scan_runs et répond avec son id, puis lance l'analyse via after() — qui
 * continue même si l'admin quitte la page.
 */
export async function POST(request: Request) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(request);
  const config = RATE_LIMITS["scanner:run"];
  const rl = await rateLimitWithBackoff(`scanner:run:${ip}`, config.maxAttempts, config.windowMs);
  if (!rl.allowed) {
    return Response.json({ error: "Trop de scans lancés, réessaie dans quelques minutes." }, { status: 429 });
  }

  const { category } = await request.json();
  if (!category || !getScanCategory(category)) {
    return Response.json({ error: "Catégorie invalide." }, { status: 400 });
  }

  const { data: run, error } = await supabaseAdmin
    .from("scan_runs")
    .insert({ admin_id: admin.id, category, status: "pending" })
    .select("id")
    .single();

  if (error || !run) {
    return Response.json(
      { error: sanitizeErrorMessage(error?.message || "Impossible de démarrer le scan.") },
      { status: 500 },
    );
  }

  const runId = run.id as string;

  after(async () => {
    try {
      await runScan(runId, category);
    } catch (err) {
      console.error("[scanner] Échec inattendu en arrière-plan:", err);
    }
  });

  return Response.json({ runId }, { status: 202 });
}
