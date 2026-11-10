import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff } from "@/lib/rateLimitAdvanced";
import { realEmail } from "@/lib/childEmail";
import { sendVerificationEmail } from "@/lib/emailVerification";

/** Renvoie le lien de vérification au parent connecté (3 envois par heure au plus). */
export async function POST(req: Request) {
  const me = await getAuthenticatedUser(req);
  if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const rl = await rateLimitWithBackoff(`resend-verification:${me.id}`, 3, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "Trop de demandes. Réessayez dans une heure." }, { status: 429 });

  const { data: row } = await supabaseAdmin.from("users").select("id, email, first_name, email_verified_at").eq("id", me.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  if (row.email_verified_at) return NextResponse.json({ ok: true, alreadyVerified: true });
  const email = realEmail(row.email);
  if (!email) return NextResponse.json({ error: "Aucune adresse e-mail sur ce compte." }, { status: 400 });

  const sent = await sendVerificationEmail({ userId: row.id, email, firstName: row.first_name || "" });
  if (!sent) return NextResponse.json({ error: "L'e-mail n'a pas pu être envoyé. Réessayez dans quelques minutes." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
