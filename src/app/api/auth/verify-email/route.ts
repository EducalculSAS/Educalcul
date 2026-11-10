import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getClientIp } from "@/lib/apiAuth";
import { rateLimitWithBackoff } from "@/lib/rateLimitAdvanced";
import { getRequestSiteUrl } from "@/lib/siteUrl";
import { hashVerifyToken, markEmailVerified } from "@/lib/emailVerification";

/** Lien reçu par e-mail : confirme l'adresse du compte parent, puis ouvre l'espace parent (ou la connexion). */
export async function GET(req: Request) {
  const base = getRequestSiteUrl(req);
  const fail = (reason: string) => NextResponse.redirect(`${base}/auth/connexion?email=${reason}`);

  const rl = await rateLimitWithBackoff(`verify-email:${getClientIp(req)}`, 30, 60 * 60 * 1000);
  if (!rl.allowed) return fail("trop-de-tentatives");

  const token = new URL(req.url).searchParams.get("t") || "";
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return fail("lien-invalide");

  const { data: row } = await supabaseAdmin
    .from("users")
    .select("id, email_verify_expires_at")
    .eq("email_verify_token_hash", hashVerifyToken(token))
    .maybeSingle();
  if (!row) return fail("lien-invalide");
  if (!row.email_verify_expires_at || new Date(row.email_verify_expires_at) < new Date()) return fail("lien-expire");

  await markEmailVerified(row.id);
  // Connecté : l'espace parent s'ouvre ; sinon le layout renvoie vers la connexion.
  return NextResponse.redirect(`${base}/parent/dashboard?email=verifie`);
}
