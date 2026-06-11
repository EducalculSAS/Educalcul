import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

async function resolveAdmin(authId: string) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("auth_id", authId)
    .maybeSingle();
  return data && data.role === "admin" ? data : null;
}

// GET: list all global events (vacances, événements globaux...)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const admin = await resolveAdmin(userId);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("global_calendar_events")
      .select("*")
      .order("start_date", { ascending: true });
    if (error) throw error;

    return NextResponse.json({ events: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: create a global event
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, title, description, event_type, start_date, end_date } = body;
    if (!userId || !title || !start_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = await resolveAdmin(userId);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("global_calendar_events")
      .insert({
        title,
        description: description || null,
        event_type: event_type || "vacances",
        start_date,
        end_date: end_date || null,
        created_by: admin.id,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ event: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
