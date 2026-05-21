import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

// GET — tickets de l'utilisateur
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId"); // auth_id
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const { data: tickets, error } = await supabaseAdmin
      .from("support_tickets")
      .select(`
        id, subject, message, status, priority, created_at, updated_at,
        replies:ticket_replies(id, admin_name, reply_message, replied_at)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(tickets || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — créer un ticket
export async function POST(req: Request) {
  try {
    const { userId, userEmail, userName, subject, message, priority } = await req.json();
    if (!userId || !subject || !message) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        user_id: userId,
        user_email: userEmail || "",
        user_name: userName || "",
        subject,
        message,
        priority: priority === "high" ? "high" : "normal",
        status: "Ouvert",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
