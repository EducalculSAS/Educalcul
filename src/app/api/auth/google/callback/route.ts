import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");

  const redirectUri = `${origin}/api/auth/google/callback`;

  if (errorParam || !code) {
    return NextResponse.redirect(
      `${origin}/auth/connexion?error=oauth&message=${encodeURIComponent(
        errorParam || "Connexion Google annulée."
      )}`
    );
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.id_token) {
      throw new Error(tokenData.error_description || tokenData.error || "Échange de token Google échoué.");
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: tokenData.id_token,
    });

    if (error || !data.session) {
      throw new Error(error?.message || "Connexion Supabase via Google échouée.");
    }

    const { access_token, refresh_token } = data.session;
    return NextResponse.redirect(
      `${origin}/auth/callback#access_token=${access_token}&refresh_token=${refresh_token}`
    );
  } catch (err: unknown) {
    console.error("[auth/google/callback] error:", err);
    return NextResponse.redirect(
      `${origin}/auth/connexion?error=oauth&message=${encodeURIComponent(sanitizeErrorMessage(errMessage(err) || String(err)))}`
    );
  }
}
