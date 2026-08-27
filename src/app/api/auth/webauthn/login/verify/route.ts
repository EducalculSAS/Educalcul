import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { getWebauthnRp } from "@/lib/webauthn";

// Vérifie la réponse du navigateur à la cérémonie de connexion, puis (même
// technique que l'impersonation, voir /api/admin/impersonate) génère un
// lien magique côté serveur dont on ne renvoie que le hashed_token : le
// client l'échange contre une vraie session via supabase.auth.verifyOtp,
// sans jamais avoir eu besoin du mot de passe.
export async function POST(req: Request) {
  try {
    const { email, response } = await req.json();
    if (!email || !response) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, email, role, status, ban_reason")
      .eq("email", String(email).toLowerCase())
      .maybeSingle();
    if (!user || user.role !== "admin" || user.status === "inactive" || user.ban_reason) {
      return NextResponse.json({ error: "Échec de la vérification." }, { status: 400 });
    }

    const { data: pending } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("challenge")
      .eq("user_id", user.id)
      .eq("type", "authentication")
      .maybeSingle();
    if (!pending) return NextResponse.json({ error: "Aucune tentative de connexion en cours, recommence." }, { status: 400 });

    const { data: cred } = await supabaseAdmin
      .from("webauthn_credentials")
      .select("id, credential_id, public_key, counter, transports")
      .eq("user_id", user.id)
      .eq("credential_id", response.id)
      .maybeSingle();
    if (!cred) return NextResponse.json({ error: "Clé d'accès inconnue." }, { status: 400 });

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
      return NextResponse.json({ error: "Vérification échouée." }, { status: 400 });
    }

    await supabaseAdmin
      .from("webauthn_credentials")
      .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
      .eq("id", cred.id);
    await supabaseAdmin
      .from("webauthn_challenges")
      .delete()
      .eq("user_id", user.id)
      .eq("type", "authentication");

    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email!,
    });
    if (linkError || !link?.properties?.hashed_token) {
      return NextResponse.json({ error: sanitizeErrorMessage(linkError?.message || "Échec de génération de session") }, { status: 500 });
    }

    return NextResponse.json({ verified: true, tokenHash: link.properties.hashed_token });
  } catch (err: any) {
    console.error("[webauthn/login/verify] failed:", err);
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
