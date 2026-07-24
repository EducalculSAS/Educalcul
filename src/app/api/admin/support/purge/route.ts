import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";


export async function DELETE(request: Request) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireRole(request, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Delete replies for archived tickets first (if cascade is not set, though cascade is better)
    // To be safe, we can rely on cascade if configured, but let's try to find IDs first.

    // First, find all archived tickets
    const { data: archivedTickets, error: findError } = await supabaseAdmin
      .from("support_tickets")
      .select("id")
      .eq("is_archived", true);

    if (findError)
      return NextResponse.json({ error: sanitizeErrorMessage(findError.message) }, { status: 500 });

    if (!archivedTickets || archivedTickets.length === 0) {
      return NextResponse.json({ deletedCount: 0 });
    }

    const ticketIds = archivedTickets.map((t) => t.id);

    // Delete replies
    const { error: repliesError } = await supabaseAdmin
      .from("ticket_replies")
      .delete()
      .in("ticket_id", ticketIds);

    if (repliesError)
      return NextResponse.json(
        { error: sanitizeErrorMessage(repliesError.message) },
        { status: 500 }
      );

    // Delete tickets
    const { error: deleteError, count } = await supabaseAdmin
      .from("support_tickets")
      .delete({ count: "exact" })
      .in("id", ticketIds);

    if (deleteError)
      return NextResponse.json({ error: sanitizeErrorMessage(deleteError.message) }, { status: 500 });

    return NextResponse.json({ deletedCount: count });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
