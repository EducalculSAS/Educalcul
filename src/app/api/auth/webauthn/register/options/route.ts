import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { getWebauthnRp } from "@/lib/webauthn";

// Génère les options de la cérémonie d'enregistrement d'une clé d'accès
// (empreinte/Face ID/clé de sécurité). Ouvert à tous les rôles (admin,
// parent, enfant) — chacun gère sa propre clé depuis son profil. Exige une
// connexion COMPLÈTE (2FA comprise si le compte en a une) : avec le mot de
// passe seul, un intrus aurait pu ajouter sa propre clé comme second facteur.
export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, email, child_username")
      .eq("id", me.id)
      .maybeSingle();
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

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
  } catch (err: unknown) {
    console.error("[webauthn/register/options] failed:", err);
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
