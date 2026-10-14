import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthIdentityOnly } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { getWebauthnRp } from "@/lib/webauthn";

// Options de la vérification par clé d'accès, SECOND facteur après le mot de
// passe : l'appelant doit déjà avoir la session obtenue par mot de passe (pas
// encore la 2FA), et le compte vient de cette session, jamais d'un e-mail
// fourni par le client. L'ancienne version, ouverte à tous par e-mail,
// révélait quels comptes avaient une clé et servait de connexion sans mot de
// passe.
export async function POST(req: Request) {
  try {
    const identity = await getAuthIdentityOnly(req);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, status, ban_reason")
      .eq("auth_id", identity.authId)
      .maybeSingle();
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    if (user.status === "inactive" || user.ban_reason) return NextResponse.json({ error: "Compte suspendu" }, { status: 403 });

    const config = RATE_LIMITS["webauthn:login"];
    const rl = await rateLimitWithBackoff(`webauthn:login:${user.id}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de tentatives, réessaie dans quelques minutes." }, { status: 429 });
    }

    const { data: creds } = await supabaseAdmin
      .from("webauthn_credentials")
      .select("credential_id, transports")
      .eq("user_id", user.id);
    if (!creds?.length) return NextResponse.json({ error: "Aucune clé d'accès sur ce compte." }, { status: 400 });

    const { rpID } = getWebauthnRp(req);
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: creds.map((c) => ({
        id: c.credential_id,
        transports: (c.transports || undefined) as AuthenticatorTransport[] | undefined,
      })),
      userVerification: "preferred",
    });

    const { error } = await supabaseAdmin
      .from("webauthn_challenges")
      .upsert({ user_id: user.id, type: "authentication", challenge: options.challenge }, { onConflict: "user_id,type" });
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    return NextResponse.json(options);
  } catch (err: unknown) {
    console.error("[webauthn/login/options] failed:", err);
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
