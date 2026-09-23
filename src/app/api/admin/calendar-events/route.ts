import { NextResponse } from "next/server";
import { selectAllPages } from "@/lib/selectAllPages";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";

// GET: list all global events (vacances, événements globaux...)
export async function GET(req: Request) {
  try {
    // Vérifie le rôle à partir du Bearer token du VRAI appelant — un
    // userId fourni par le client (query param) ne prouve rien sur son
    // identité, ce n'était qu'une déclaration non vérifiée.
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const data = await selectAllPages((from, to) =>
      supabaseAdmin
        .from("global_calendar_events")
        .select("*")
        .order("start_date", { ascending: true })
        .order("id")
        .range(from, to),
    );

    return NextResponse.json({ events: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}

// POST: create a global event
export async function POST(req: Request) {
  try {
    const admin = await requireRole(req, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { title, description, event_type, start_date, end_date, zone } = body;
    if (!title || !start_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("global_calendar_events")
      .insert({
        title,
        description: description || null,
        event_type: event_type || "vacances",
        start_date,
        end_date: end_date || null,
        zone: zone || "all",
        created_by: admin.id,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ event: data });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
