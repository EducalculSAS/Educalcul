import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { createLlmStartGate, DEFAULT_LLM_MIN_START_INTERVAL_MS } from "@/lib/ai/runtime";
import { listGameTypes } from "@/lib/minigames/gameTypes";
import { generateAndUpsertDailySheet, type SheetTier } from "@/lib/minigames/runDailySheetGeneration";

export const maxDuration = 800;

const DAYS_AHEAD = 5; // aujourd'hui + 4 jours d'avance
const ARCHIVE_AFTER_DAYS = 3;
const TIERS: SheetTier[] = ["free", "premium"];

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Vérifié quotidiennement par Vercel Cron (voir vercel.json). Vercel signe la
// requête avec CRON_SECRET dans l'en-tête Authorization — même garde que
// /api/cron/grade-promotion.
//
// Idempotent : boucle sur les 4 jeux du registre (chacun avec SA plage de
// paliers, pas systématiquement les 12 — voir src/lib/minigames/gameTypes.ts)
// × 2 tiers × 5 jours, ne génère que les créneaux qui n'existent pas déjà —
// une exécution interrompue en cours de route (ou qui n'a pas le temps de
// tout faire en un run, le volume total étant plus grand qu'avec un seul
// jeu) est simplement complétée par le run du lendemain.
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return toDateStr(d);
  });

  const { data: existingRows } = await supabaseAdmin
    .from("minigame_daily_sheets")
    .select("game_type, palier_code, for_date, tier")
    .in("for_date", dates);
  const existing = new Set((existingRows || []).map((r) => `${r.game_type}|${r.palier_code}|${r.for_date}|${r.tier}`));

  let generated = 0;
  let failed = 0;
  const errors: string[] = [];

  // Un seul gate PARTAGÉ pour TOUT le run (tous jeux confondus) : en créer un
  // par créneau annulerait l'espacement entre appels LLM et déclencherait le
  // rate-limit du modèle (vécu lors du premier test — 429 dès le 2e appel).
  const generate = createLlmStartGate(DEFAULT_LLM_MIN_START_INTERVAL_MS, () => Promise.resolve(false));

  for (const { gameType, palierCodes, hasPremiumBonus } of listGameTypes()) {
    const tiersForGame = hasPremiumBonus === false ? (["free"] as SheetTier[]) : TIERS;
    for (const palierCode of palierCodes) {
      for (const date of dates) {
        for (const tier of tiersForGame) {
          const key = `${gameType}|${palierCode}|${date}|${tier}`;
          if (existing.has(key)) continue;
          try {
            const result = await generateAndUpsertDailySheet(gameType, palierCode, date, tier, { generate });
            if (result.error) {
              failed++;
              errors.push(`${key}: ${result.error}`);
            } else {
              generated++;
            }
          } catch (err) {
            // Un créneau qui échoue ne doit jamais faire tomber tout le run.
            failed++;
            errors.push(`${key}: ${err instanceof Error ? err.message : "erreur inconnue"}`);
          }
        }
      }
    }
  }

  const archiveCutoff = new Date(today);
  archiveCutoff.setDate(archiveCutoff.getDate() - ARCHIVE_AFTER_DAYS);
  const { data: archived } = await supabaseAdmin
    .from("minigame_daily_sheets")
    .update({ is_archived: true, archived_at: new Date().toISOString() })
    .lt("for_date", toDateStr(archiveCutoff))
    .eq("is_archived", false)
    .select("id");

  return NextResponse.json({
    generated,
    failed,
    errors: errors.slice(0, 10),
    archived: archived?.length || 0,
  });
}
