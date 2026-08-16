import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getGameTypeConfig, isMinigameType } from "@/lib/minigames/gameTypes";
import { generateAndUpsertDailySheet } from "@/lib/minigames/runDailySheetGeneration";

export const maxDuration = 300;

/** Contenu du jour pour les paliers d'un jeu (free + premium) — vue "un
 * bloc par palier" utilisée par l'admin. Le contenu est normalement déjà
 * généré par le cron (/api/cron/minigames-daily) ; cette route sert juste à
 * le lire. */
export async function GET(request: Request) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const gameType = url.searchParams.get("gameType") || "calcul_mental";
  if (!isMinigameType(gameType)) return Response.json({ error: "Jeu inconnu." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("minigame_daily_sheets")
    .select("id, palier_code, tier, questions, status, is_archived, updated_at, language")
    .eq("game_type", gameType)
    .eq("for_date", date);

  if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return Response.json({ date, sheets: data || [] });
}

/** Génère (ou régénère) manuellement un créneau précis — secours en dehors
 * du cron quotidien, ex. contenu à corriger ou buffer pas encore rempli. */
export async function POST(request: Request) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const config = RATE_LIMITS["ai:admin"];
  const rl = await rateLimitWithBackoff(`ai:admin:${ip}`, config.maxAttempts, config.windowMs);
  if (!rl.allowed) {
    return Response.json({ error: "Trop de générations IA, réessaie dans quelques minutes." }, { status: 429 });
  }

  const body = await request.json();
  const gameType = String(body?.gameType || "calcul_mental");
  const palierCode = String(body?.palierCode || "");
  const date = String(body?.date || "");
  const tier = body?.tier === "premium" ? "premium" : "free";

  if (!isMinigameType(gameType)) return Response.json({ error: "Jeu inconnu." }, { status: 400 });
  const gameConfig = getGameTypeConfig(gameType);
  if (!gameConfig?.palierCodes.includes(palierCode as any)) {
    return Response.json({ error: "Palier hors plage pour ce jeu." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "Date invalide." }, { status: 400 });

  const result = await generateAndUpsertDailySheet(gameType, palierCode as any, date, tier);
  if (result.error) return Response.json({ error: sanitizeErrorMessage(result.error) }, { status: 500 });
  return Response.json({ success: true });
}
