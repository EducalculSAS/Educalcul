import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthIdentityOnly } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { getWebauthnRp } from "@/lib/webauthn";
import { issueTwoFactorSession } from "@/lib/twoFactorSession";
import { auditLog, AuditAction } from "@/lib/auditLog";

// Vérifie la réponse du navigateur (clé d'accès) pour le compte de la session
// en cours, puis émet la session 2FA — exactement comme un code e-mail ou
// TOTP validé. La clé d'accès est ainsi un vrai second facteur, contrôlé par
// le serveur (getAuthenticatedUser l'exige pour tout compte qui en a une).
//
// Avant : route ouverte à tous par e-mail, qui renvoyait un lien magique =
// connexion SANS mot de passe. Une clé ajoutée par un intrus survivait donc à
// un changement de mot de passe.
export async function POST(req: Request) {
  try {
    const identity = await getAuthIdentityOnly(req);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { response } = await req.json().catch(() => ({}));
    if (!response || typeof response.id !== "string") {
      return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, role, status, ban_reason")
      .eq("auth_id", identity.authId)
      .maybeSingle();
    if (!user || user.status === "inactive" || user.ban_reason) {
      return NextResponse.json({ error: "Échec de la vérification." }, { status: 400 });
    }

    const [{ data: pending }, { data: cred }] = await Promise.all([
      supabaseAdmin
        .from("webauthn_challenges")
        .select("challenge")
        .eq("user_id", user.id)
        .eq("type", "authentication")
        .maybeSingle(),
      supabaseAdmin
        .from("webauthn_credentials")
        .select("id, credential_id, public_key, counter, transports")
        .eq("user_id", user.id)
        .eq("credential_id", response.id)
        .maybeSingle(),
    ]);
    if (!pending) return NextResponse.json({ error: "Aucune vérification en cours, recommence." }, { status: 400 });
    if (!cred) return NextResponse.json({ error: "Clé d'accès inconnue." }, { status: 400 });

    // Défi à usage unique : consommé avant même la vérification, pour qu'une
    // réponse interceptée ne puisse pas être rejouée.
    await supabaseAdmin.from("webauthn_challenges").delete().eq("user_id", user.id).eq("type", "authentication");

    const { rpID, origin } = getWebauthnRp(req);
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.credential_id,
        publicKey: isoBase64URL.toBuffer(cred.public_key),
        counter: cred.counter,
        transports: (cred.transports || undefined) as AuthenticatorTransport[] | undefined,
      },
    });

    if (!verification.verified) {
      await auditLog({ action: AuditAction.TWO_FACTOR_FAILED, adminId: user.id, details: { method: "passkey" } }, req).catch(() => {});
      return NextResponse.json({ error: "Vérification échouée." }, { status: 400 });
    }

    const [session] = await Promise.all([
      issueTwoFactorSession(user, req),
      supabaseAdmin
        .from("webauthn_credentials")
        .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
        .eq("id", cred.id),
    ]);
    if ("error" in session) return NextResponse.json({ error: sanitizeErrorMessage(session.error) }, { status: 500 });

    await auditLog({ action: AuditAction.TWO_FACTOR_VERIFIED, adminId: user.id, details: { method: "passkey" } }, req).catch(() => {});
    return NextResponse.json({ verified: true, expiresAt: session.expiresAt });
  } catch (err: any) {
    console.error("[webauthn/login/verify] failed:", err);
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
