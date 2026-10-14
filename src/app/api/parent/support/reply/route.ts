import { NextRequest, NextResponse } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";

export async function POST(req: NextRequest) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { ticketId, message } = await req.json();
    if (!ticketId || !message?.trim()) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    // Vérifier que le ticket appartient bien à cet utilisateur (en parallèle
    // avec la lecture du profil, ces deux lectures étant indépendantes)
    const [{ data: ticket }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("support_tickets")
        .select("id, user_id, user_name, user_email")
        .eq("id", ticketId)
        .eq("user_id", me.authId)
        .maybeSingle(),
      supabaseAdmin
        .from("users").select("first_name, last_name").eq("id", me.id).maybeSingle(),
    ]);

    if (!ticket) return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });

    const authorName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : ticket.user_name;

    // Insérer la réponse
    const { data: reply, error: replyErr } = await supabaseAdmin.from("ticket_replies").insert({
      ticket_id: ticketId,
      admin_name: authorName,
      author_name: authorName,
      reply_message: message.trim(),
      is_admin: false,
      replied_at: new Date().toISOString(),
    }).select().single();

    if (replyErr) return NextResponse.json({ error: sanitizeErrorMessage(replyErr.message) }, { status: 500 });

    // Mettre à jour le statut du ticket
    await supabaseAdmin.from("support_tickets")
      .update({ status: "En attente", updated_at: new Date().toISOString() })
      .eq("id", ticketId);

    return NextResponse.json({ success: true, reply });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
