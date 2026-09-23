import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { issueTwoFactorSession } from "@/lib/twoFactorSession";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { getWebauthnRp } from "@/lib/webauthn";

// Vérifie la réponse du navigateur à la cérémonie d'enregistrement et
// enregistre la clé d'accès si tout est valide. Connexion complète exigée
// (voir /register/options).
export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { response, deviceLabel } = await req.json();
    if (!response) return NextResponse.json({ error: "Réponse manquante" }, { status: 400 });

    const { data: pending } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("challenge")
      .eq("user_id", user.id)
      .eq("type", "registration")
      .maybeSingle();
    if (!pending) return NextResponse.json({ error: "Aucune tentative d'enregistrement en cours, recommence." }, { status: 400 });

    const { rpID, origin } = getWebauthnRp(req);

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "Vérification échouée." }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;

    const { error: insertError } = await supabaseAdmin.from("webauthn_credentials").insert({
      user_id: user.id,
      credential_id: credential.id,
      public_key: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports: response.response?.transports || null,
      device_label: typeof deviceLabel === "string" && deviceLabel.trim() ? deviceLabel.trim().slice(0, 60) : "Appareil",
    });
    if (insertError) {
      console.error("[webauthn/register/verify] insert failed:", insertError);
      return NextResponse.json({ error: sanitizeErrorMessage(insertError.message) }, { status: 500 });
    }

    await supabaseAdmin
      .from("webauthn_challenges")
      .delete()
      .eq("user_id", user.id)
      .eq("type", "registration");

    // Dès qu'il a une clé, le compte exige la 2FA sur chaque appel. Un compte
    // qui n'en avait pas encore serait donc déconnecté aussitôt : on ouvre la
    // session 2FA de cet appareil, qui vient de prouver la possession de la clé.
    const session = await issueTwoFactorSession(user, req);
    if ("error" in session) console.error("[webauthn/register/verify] 2FA session failed:", session.error);

    return NextResponse.json({ verified: true });
  } catch (err: any) {
    console.error("[webauthn/register/verify] failed:", err);
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
