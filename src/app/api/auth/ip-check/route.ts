import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthIdentityOnly, getClientIp, isIpAllowed } from "@/lib/apiAuth";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";

/**
 * Premier gate du flux de connexion, appelé juste après signInWithPassword
 * et AVANT toute vérification passkey/2FA (voir ConnexionClient.tsx) : un
 * compte restreint (admin_allowed_ips) connecté depuis une IP hors liste ne
 * doit voir ni OTP ni prompt passkey — juste échouer comme un mot de passe
 * incorrect (aucune fuite d'info sur l'existence de la restriction).
 *
 * Défense en profondeur, pas le seul rempart : getAuthenticatedUser
 * (apiAuth.ts) applique la même restriction sur TOUT appel /api/* déjà
 * authentifié, donc un jeton/2FA valides depuis avant ne suffisent pas non
 * plus une fois l'IP hors liste.
 */
export async function GET(req: Request) {
  try {
    const identity = await getAuthIdentityOnly(req);
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("admin_allowed_ips")
      .eq("auth_id", identity.authId)
      .maybeSingle();

    const allowed = isIpAllowed(user?.admin_allowed_ips, req);
    return NextResponse.json({ allowed, ip: getClientIp(req) });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err) || "Erreur interne") }, { status: 500 });
  }
}
