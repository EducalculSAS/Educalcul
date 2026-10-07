import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { miniComment } from "@/lib/gradeFreeAnswer";

export const maxDuration = 30;

/** Mini commentaire de l'IA sur une erreur (la correction a déjà répondu : verdict et réponse de base instantanés). */
export async function POST(req: Request) {
  const me = await getAuthenticatedUser(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cfg = RATE_LIMITS["ai:grade"];
  const rl = await rateLimitWithBackoff(`ai:comment:${me.authId}`, cfg.maxAttempts * 2, cfg.windowMs);
  if (!rl.allowed) return NextResponse.json({ comment: "" });

  const { token } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || token.length > 8000) return NextResponse.json({ comment: "" });
  return NextResponse.json({ comment: await miniComment(token) });
}
