import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff } from "@/lib/rateLimitAdvanced";
import { getWithdrawalQuote, withdraw } from "@/lib/withdrawal";

/** Fonction de rétractation (voir src/lib/withdrawal.ts). GET : droit ouvert ? POST : se rétracter. */
export async function GET(req: Request) {
  const me = await getAuthenticatedUser(req);
  if (!me || me.role !== "parent") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getWithdrawalQuote(me.authId));
}

export async function POST(req: Request) {
  const me = await getAuthenticatedUser(req);
  if (!me || me.role !== "parent") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await rateLimitWithBackoff(`withdrawal:${me.authId}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "Trop de tentatives, réessayez plus tard." }, { status: 429 });

  const res = await withdraw(me.authId);
  return res.ok ? NextResponse.json(res) : NextResponse.json({ error: res.error }, { status: 409 });
}
