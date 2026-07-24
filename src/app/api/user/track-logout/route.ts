import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { createClient } from "@supabase/supabase-js";
import { getIpGeo } from "@/lib/ipGeo";

export const dynamic = "force-dynamic";

async function getUser(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await client.auth.getUser(auth.replace("Bearer ", ""));
  return user;
}

export async function POST(request: Request) {
  try {
    const authUser = await getUser(request);
    if (!authUser) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const geo = await getIpGeo(request);

    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", authUser.id)
      .maybeSingle();

    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const now = new Date().toISOString();

    await supabaseAdmin.from("users").update({
      last_logout_at:      now,
      last_logout_ip:      geo.ip || null,
      last_logout_city:    geo.city || null,
      last_logout_country: geo.country || null,
    }).eq("auth_id", authUser.id);

    // Complete the most recent open session row
    await supabaseAdmin
      .from("user_login_history")
      .update({
        logged_out_at: now,
        logout_ip:      geo.ip || null,
        logout_city:    geo.city || null,
        logout_country: geo.country || null,
      })
      .eq("user_id", dbUser.id)
      .is("logged_out_at", null);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
