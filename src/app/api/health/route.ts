import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/** Endpoint public, sans auth (nécessaire pour un monitoring externe type
 * UptimeRobot) — vérifie que l'app répond ET que la base est joignable.
 * `?db=0` permet un ping ultra-léger sans toucher Supabase si besoin. */
export async function GET(req: Request) {
  const start = Date.now();
  const { searchParams } = new URL(req.url);
  const checkDb = searchParams.get("db") !== "0";

  let db: "ok" | "error" | "skipped" = "skipped";
  if (checkDb) {
    try {
      // Une ligne suffit à prouver que la base répond (un count exact parcourait toute la table).
      const { error } = await supabaseAdmin.from("users").select("id").limit(1);
      db = error ? "error" : "ok";
    } catch {
      db = "error";
    }
  }

  const healthy = db !== "error";

  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      db,
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
