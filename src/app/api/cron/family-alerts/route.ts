import { NextResponse } from "next/server";
import { runInactivityAlerts } from "@/lib/parentAlerts";

export const maxDuration = 300;

/**
 * Alertes quotidiennes aux parents (17 h UTC, voir vercel.json) : un enfant qui n'a plus rien fait depuis plusieurs jours
 * (seuil réglé par chaque parent dans Profil > Alertes). `?dry=1` compte sans rien envoyer.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dryRun = new URL(req.url).searchParams.get("dry") === "1";
  return NextResponse.json(await runInactivityAlerts(new Date(), { dryRun }));
}
