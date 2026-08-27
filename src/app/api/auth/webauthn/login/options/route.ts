import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { getWebauthnRp } from "@/lib/webauthn";

// Génère les options de la cérémonie de connexion par clé d'accès, pour
// l'email donné. Pas de session requise ici — c'est justement le moyen de
// s'authentifier. Ne révèle jamais si l'email existe ou non : en l'absence
// de clé enregistrée, on renvoie quand même des options valides mais sans
// aucun allowCredentials (la cérémonie échouera simplement côté navigateur).
export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email manquant" }, { status: 400 });
    }

    const config = RATE_LIMITS["webauthn:login"];
    const rl = await rateLimitWithBackoff(`webauthn:login:${email.toLowerCase()}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de tentatives, réessaie dans quelques minutes." }, { status: 429 });
    }

    const { rpID } = getWebauthnRp(req);
    let allowCredentials: { id: string; transports?: AuthenticatorTransport[] }[] = [];

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, role, status, ban_reason")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (user && user.role === "admin" && user.status !== "inactive" && !user.ban_reason) {
      const { data: creds } = await supabaseAdmin
        .from("webauthn_credentials")
        .select("credential_id, transports")
        .eq("user_id", user.id);
      allowCredentials = (creds || []).map((c) => ({
        id: c.credential_id,
        transports: (c.transports || undefined) as AuthenticatorTransport[] | undefined,
      }));

      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials,
        userVerification: "preferred",
      });

      await supabaseAdmin
        .from("webauthn_challenges")
        .upsert({ user_id: user.id, type: "authentication", challenge: options.challenge }, { onConflict: "user_id,type" });

      return NextResponse.json(options);
    }

    // Compte inexistant/non-admin/sans clé : options "vides" mais de forme
    // valide, pour ne pas laisser deviner si l'email existe.
    const options = await generateAuthenticationOptions({ rpID, allowCredentials: [], userVerification: "preferred" });
    return NextResponse.json(options);
  } catch (err: any) {
    console.error("[webauthn/login/options] failed:", err);
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
