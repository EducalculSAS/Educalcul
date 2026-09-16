import { NextRequest, NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { data: tickets, error } = await supabaseAdmin
      .from("support_tickets")
      .select(`id, subject, message, status, created_at, updated_at, replies:ticket_replies(id, reply_message, is_admin, author_name, replied_at)`)
      .eq("user_id", me.authId)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false });

    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
    return NextResponse.json(tickets || []);
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
