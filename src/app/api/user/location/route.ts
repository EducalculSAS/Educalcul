import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { createClient } from "@supabase/supabase-js";

async function getUser(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
  return user;
}

export async function DELETE(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  await supabaseAdmin.from("users").update({
    latitude: null, longitude: null, location_precise: false,
  }).eq("auth_id", user.id);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  try {
    const { latitude, longitude, city } = await request.json();

    if (!latitude || !longitude) {
      return NextResponse.json({ error: "Coordonnées manquantes" }, { status: 400 });
    }

    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const updates: Record<string, any> = {
      latitude,
      longitude,
      location_precise: true,
    };
    if (city) updates.last_login_city = city;

    await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("auth_id", user.id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
