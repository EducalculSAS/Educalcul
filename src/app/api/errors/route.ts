import { NextResponse } from "next/server";
import { recordError } from "@/lib/errorLog";
import { getAuthenticatedUser, getClientIp } from "@/lib/apiAuth";
import { rateLimitWithBackoff } from "@/lib/rateLimitAdvanced";

/**
 * Erreurs remontées par les navigateurs (voir ErrorReporter). Ouvert à tous
 * (une erreur peut survenir avant la connexion) mais plafonné par adresse IP
 * et borné en taille : impossible d'en faire un moyen de remplir la base.
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = await rateLimitWithBackoff(`errors:${ip}`, 30, 60 * 60 * 1000);
    if (!rl.allowed) return new NextResponse(null, { status: 204 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body.message !== "string" || !body.message.trim()) return new NextResponse(null, { status: 204 });

    const me = await getAuthenticatedUser(req).catch(() => null);
    await recordError({
      source: "client",
      message: body.message.slice(0, 1000),
      stack: typeof body.stack === "string" ? body.stack.slice(0, 6000) : null,
      url: typeof body.url === "string" ? body.url.slice(0, 500) : null,
      userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      userId: me?.id ?? null,
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
