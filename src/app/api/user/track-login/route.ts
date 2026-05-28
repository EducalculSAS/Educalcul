import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { createClient } from "@supabase/supabase-js";

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

    const { city, country, ip, device_type, user_agent, latitude, longitude } = await request.json().catch(() => ({}));

    // Fetch DB user
    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select("id, login_count, login_streak, last_login_date, status, ban_reason")
      .eq("auth_id", authUser.id)
      .maybeSingle();

    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const isNewDay = dbUser.last_login_date !== today;

    const updates: Record<string, any> = { last_active_at: new Date().toISOString() };

    if (isNewDay) {
      updates.last_login_date = today;
      updates.login_count = (dbUser.login_count || 0) + 1;
      updates.login_streak = dbUser.last_login_date === yesterday ? (dbUser.login_streak || 0) + 1 : 1;
      if (city)    updates.last_login_city    = city;
      if (country) updates.last_login_country = country;
      if (ip)      updates.last_login_ip      = ip;
      if (device_type) updates.device_type    = device_type;
      if (user_agent)  updates.user_agent     = user_agent;
    }

    // Update users table
    await supabaseAdmin.from("users").update(updates).eq("auth_id", authUser.id);

    // Always insert a login history row (one per session/day)
    if (isNewDay) {
      await supabaseAdmin.from("user_login_history").insert({
        user_id:     dbUser.id,
        logged_at:   new Date().toISOString(),
        city:        city        || null,
        country:     country     || null,
        ip:          ip          || null,
        device_type: device_type || null,
        user_agent:  user_agent  || null,
        latitude:    latitude    || null,
        longitude:   longitude   || null,
      });
    }

    return NextResponse.json({ ok: true, is_new_day: isNewDay });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
