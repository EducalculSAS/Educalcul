import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { createClient } from "@supabase/supabase-js";
import { getIpGeo } from "@/lib/ipGeo";
import { hashTwoFactorValue } from "@/lib/twoFactor";
import {
  getTwoFactorCookieFromRequest,
  clearTwoFactorCookie,
} from "@/lib/twoFactorCookie";

export const dynamic = "force-dynamic";

async function getUser(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const {
    data: { user },
  } = await client.auth.getUser(auth.replace("Bearer ", ""));
  return user;
}

export async function POST(request: Request) {
  try {
    const authUser = await getUser(request);
    if (!authUser)
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const geo = await getIpGeo(request);

    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", authUser.id)
      .maybeSingle();

    if (!dbUser)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const now = new Date().toISOString();

    // Révoque aussi la session 2FA (cookie httpOnly) : sans ça, se
    // déconnecter du compte Supabase ne coupait pas ce jeton séparé, encore
    // valide pour les 4h/30j restantes de son TTL si jamais réutilisé.
    const twoFAToken = getTwoFactorCookieFromRequest(request);

    // Independent writes — run in parallel.
    await Promise.all([
      supabaseAdmin
        .from("users")
        .update({
          last_logout_at: now,
          last_logout_ip: geo.ip || null,
          last_logout_city: geo.city || null,
          last_logout_country: geo.country || null,
          latitude: geo.latitude !== undefined ? geo.latitude : null,
          longitude: geo.longitude !== undefined ? geo.longitude : null,
        })
        .eq("auth_id", authUser.id),
      // Complete the most recent open session row
      supabaseAdmin
        .from("user_login_history")
        .update({
          logged_out_at: now,
          logout_ip: geo.ip || null,
          logout_city: geo.city || null,
          logout_country: geo.country || null,
          logout_latitude: geo.latitude !== undefined ? geo.latitude : null,
          logout_longitude: geo.longitude !== undefined ? geo.longitude : null,
        })
        .eq("user_id", dbUser.id)
        .is("logged_out_at", null),
      twoFAToken
        ? supabaseAdmin
            .from("two_factor_sessions")
            .delete()
            .eq("user_id", dbUser.id)
            .eq("token_hash", hashTwoFactorValue(twoFAToken))
        : Promise.resolve(),
    ]);

    await clearTwoFactorCookie();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err.message) },
      { status: 500 },
    );
  }
}
