import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { createClient } from "@supabase/supabase-js";
import { getIpGeo } from "@/lib/ipGeo";
import {
  DEVICE_ID_COOKIE_NAME,
  DEVICE_ID_COOKIE_MAX_AGE,
  getDeviceIdFromRequest,
  summarizeDeviceLabel,
  decodeSessionIdFromAuthHeader,
} from "@/lib/deviceIdentity";

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

    const { device_type, user_agent } = await request.json().catch(() => ({}));
    const geo = await getIpGeo(request);

    // Fetch DB user
    const { data: dbUser } = await supabaseAdmin
      .from("users")
      .select(
        "id, login_count, login_streak, last_login_date, status, ban_reason",
      )
      .eq("auth_id", authUser.id)
      .maybeSingle();

    if (!dbUser)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split("T")[0];
    const isNewDay = dbUser.last_login_date !== today;

    const updates: Record<string, any> = {
      last_active_at: new Date().toISOString(),
    };

    // Toujours mettre à jour la localisation à chaque ping (IP peut avoir changé)
    if (geo.ip) updates.last_login_ip = geo.ip;
    if (geo.city) updates.last_login_city = geo.city;
    if (geo.country) updates.last_login_country = geo.country;
    if (geo.latitude !== undefined) updates.latitude = geo.latitude;
    if (geo.longitude !== undefined) updates.longitude = geo.longitude;
    if (device_type) updates.device_type = device_type;
    if (user_agent) updates.user_agent = user_agent;

    if (isNewDay) {
      updates.last_login_date = today;
      updates.login_count = (dbUser.login_count || 0) + 1;
      updates.login_streak =
        dbUser.last_login_date === yesterday
          ? (dbUser.login_streak || 0) + 1
          : 1;
    }

    // Update users table + insert login history row (independent writes, run in parallel)
    if (isNewDay) {
      await Promise.all([
        supabaseAdmin.from("users").update(updates).eq("auth_id", authUser.id),
        supabaseAdmin.from("user_login_history").insert({
          user_id: dbUser.id,
          logged_at: new Date().toISOString(),
          ip: geo.ip || null,
          city: geo.city || null,
          country: geo.country || null,
          latitude: geo.available ? geo.latitude : null,
          longitude: geo.available ? geo.longitude : null,
          device_type: device_type || null,
          user_agent: user_agent || null,
        }),
      ]);
    } else {
      await supabaseAdmin
        .from("users")
        .update(updates)
        .eq("auth_id", authUser.id);
    }

    // "Appareils connectés" (voir UserSessionsList.tsx) : une ligne par
    // appareil PHYSIQUE, identifié par un cookie stable — pas une ligne par
    // connexion Supabase (auth.sessions en crée une nouvelle à chaque
    // signInWithPassword, y compris pour le même Mac qui se reconnecte,
    // d'où les doublons "Mac"/"Ordinateur" observés). Cet appel est déjà
    // fait à chaque montage + toutes les 2 min (throttle 25s côté client),
    // donc last_active_at reste à jour sans action supplémentaire, et le
    // session_id stocké reste quasi toujours frais pour la révocation.
    let deviceId = getDeviceIdFromRequest(request);
    const isNewDeviceCookie = !deviceId;
    if (!deviceId) deviceId = crypto.randomUUID();

    const sessionId = decodeSessionIdFromAuthHeader(request);
    await supabaseAdmin.from("user_devices").upsert(
      {
        auth_id: authUser.id,
        device_id: deviceId,
        label: summarizeDeviceLabel(user_agent),
        user_agent: user_agent || null,
        session_id: sessionId,
        last_active_at: new Date().toISOString(),
      },
      { onConflict: "auth_id,device_id" },
    );

    const response = NextResponse.json({ ok: true, is_new_day: isNewDay });
    if (isNewDeviceCookie) {
      response.cookies.set(DEVICE_ID_COOKIE_NAME, deviceId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: DEVICE_ID_COOKIE_MAX_AGE,
      });
    }
    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err.message) },
      { status: 500 },
    );
  }
}
