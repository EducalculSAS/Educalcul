import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/apiAuth";
import { rateLimitWithBackoff } from "@/lib/rateLimitAdvanced";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { classifySource, trackablePath } from "@/lib/trafficSources";

/**
 * Compte une visite d'une page PUBLIQUE selon son origine (ChatGPT, Google, autre site…). Sans cookie, sans identifiant,
 * sans adresse IP enregistrée : un compteur par jour, source et page. Réponse toujours 204 (jamais d'erreur visible).
 */
const OWN_HOSTS = ["educalcul.com", "educalcul.vercel.app", "localhost", "127.0.0.1"];

export async function POST(req: Request) {
  const done = new NextResponse(null, { status: 204 });
  try {
    const rl = await rateLimitWithBackoff(`track:visit:${getClientIp(req)}`, 30, 60_000);
    if (!rl.allowed) return done;
    const body = await req.json().catch(() => ({}));
    const path = trackablePath(body?.path);
    if (!path) return done;
    const source = classifySource(typeof body?.referrer === "string" ? body.referrer : null, typeof body?.utm === "string" ? body.utm : null, OWN_HOSTS);
    if (!source) return done;
    await supabaseAdmin.rpc("bump_traffic_visit", { p_source: source, p_path: path });
  } catch (err) {
    console.error("[track/visit]", err instanceof Error ? err.message : err);
  }
  return done;
}
