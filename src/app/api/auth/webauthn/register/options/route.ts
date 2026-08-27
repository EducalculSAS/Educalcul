import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthIdentityOnly } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { getWebauthnRp } from "@/lib/webauthn";

// Génère les options de la cérémonie d'enregistrement d'une clé d'accès
// (empreinte/Face ID/clé de sécurité). Réservé aux admins, comme le TOTP.
export async function POST(req: Request) {
  try {
    const identity = await getAuthIdentityOnly(req);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, role, email, status, ban_reason, child_username")
      .eq("auth_id", identity.authId)
      .maybeSingle();
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    if (user.status === "inactive" || user.ban_reason) return NextResponse.json({ error: "Compte suspendu" }, { status: 403 });
    if (user.role !== "admin") return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });

    const config = RATE_LIMITS["webauthn:register"];
    const rl = await rateLimitWithBackoff(`webauthn:register:${user.id}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de demandes, réessaie dans quelques minutes." }, { status: 429 });
    }

    const { data: existingCreds } = await supabaseAdmin
      .from("webauthn_credentials")
      .select("credential_id")
      .eq("user_id", user.id);

    const { rpID, rpName } = getWebauthnRp(req);

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: isoUint8Array.fromUTF8String(String(user.id)),
      userName: user.email || user.child_username || `admin-${user.id}`,
      attestationType: "none",
      excludeCredentials: (existingCreds || []).map((c) => ({ id: c.credential_id })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
        // "platform" cible l'empreinte/Face ID de l'appareil plutôt qu'une
        // clé de sécurité externe — c'est ce que l'utilisateur a demandé.
        authenticatorAttachment: "platform",
      },
    });

    const { error } = await supabaseAdmin
      .from("webauthn_challenges")
      .upsert({ user_id: user.id, type: "registration", challenge: options.challenge }, { onConflict: "user_id,type" });
    if (error) {
      console.error("[webauthn/register/options] upsert challenge failed:", error);
      return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
    }

    return NextResponse.json(options);
  } catch (err: any) {
    console.error("[webauthn/register/options] failed:", err);
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
