import { after, NextResponse } from "next/server";
import { kickChains, processNextQueuedExercise } from "@/lib/ai/exerciseBatch";

export const maxDuration = 300;

/**
 * Une chaîne de la génération par lots : prend UN exercice en file, le génère (dans after(), côté Vercel), puis se
 * rappelle pour le suivant tant qu'il en reste. Voir src/lib/ai/exerciseBatch.ts.
 */
async function handle(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const origin = new URL(req.url).origin;
  after(async () => {
    let worked = false;
    try {
      worked = await processNextQueuedExercise();
    } catch (err) {
      console.error("[exercise-queue-advance] échec:", err);
      worked = true;
    } finally {
      if (worked) await kickChains(origin, 1);
    }
  });
  return NextResponse.json({ started: true }, { status: 202 });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
