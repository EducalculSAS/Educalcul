import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { pumpQueue } from "@/lib/ai/exerciseBatch";

export const maxDuration = 300;

/**
 * Horloge de la génération par lots. Appelée chaque minute par pg_cron (tâche « exercise-queue-clock », seulement
 * s'il reste des exercices en attente, jeton du coffre-fort Supabase) ou par l'admin (lancement, relance).
 * Elle démarre, dans cette même fonction, les générations qui manquent pour atteindre le parallélisme voulu :
 * aucune fonction ne s'appelle elle-même (les appels en chaîne s'arrêtaient au bout de quelques tours).
 */
async function authorized(req: Request): Promise<boolean> {
  if (process.env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`) return true;
  const token = req.headers.get("x-queue-token");
  if (!token) return false;
  const { data } = await supabaseAdmin.rpc("check_exercise_queue_token", { p_token: token });
  return data === true;
}

async function handle(req: Request) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const started = await pumpQueue();
  return NextResponse.json({ started }, { status: 202 });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }

