import { NextResponse } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";


// GET Single Ticket + Replies
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireRole(request, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Le ticket et ses réponses sont indépendants (clé étrangère connue via
    // l'id de l'URL) — inutile d'attendre le ticket avant de lancer l'autre.
    const [
      { data: ticket, error: ticketError },
      { data: replies, error: repliesError },
    ] = await Promise.all([
      supabaseAdmin.from('support_tickets').select('*').eq('id', id).single(),
      supabaseAdmin.from('ticket_replies').select('*').eq('ticket_id', id).order('replied_at', { ascending: true }),
    ]);

    // PGRST116 = aucune ligne ; 22P02 = identifiant mal formé : dans les deux cas, ticket introuvable.
    if (ticketError && ticketError.code !== "PGRST116" && ticketError.code !== "22P02") {
      return NextResponse.json({ error: sanitizeErrorMessage(ticketError.message) }, { status: 500 });
    }
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    if (repliesError) return NextResponse.json({ error: sanitizeErrorMessage(repliesError.message) }, { status: 500 });

    return NextResponse.json({ ticket, replies });
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}

// UPDATE Ticket (Status, Assign, Archive, Restore)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireRole(request, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { action, status, assigned_to } = body;

    const updates: any = { updated_at: new Date().toISOString() };

    if (action === 'change_status') {
      if (!['Ouvert', 'En cours', 'Répondu', 'Résolu'].includes(status)) {
         return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updates.status = status;
    } 
    else if (action === 'assign') {
      updates.assigned_to = assigned_to;
    }
    else if (action === 'archive') {
      updates.is_archived = true;
      updates.archived_at = new Date().toISOString();
    }
    else if (action === 'restore') {
      updates.is_archived = false;
      updates.archived_at = null;
    }
    else if (action === 'mark_resolved') {
      updates.status = 'Résolu';
    }

    const { error } = await supabaseAdmin
      .from('support_tickets')
      .update(updates)
      .eq('id', id);

    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}

// DELETE Ticket (Permanent)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireRole(request, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Check if archived
    const { data: ticket, error: checkError } = await supabaseAdmin
        .from('support_tickets')
        .select('is_archived')
        .eq('id', id)
        .single();

    if (checkError) return NextResponse.json({ error: sanitizeErrorMessage(checkError.message) }, { status: 500 });
    if (!ticket || !ticket.is_archived) {
        return NextResponse.json({ error: "Cannot delete non-archived or non-existent ticket" }, { status: 400 });
    }

    // Delete replies first (cascade might handle this, but safer to be explicit if no cascade)
    // Assuming no cascade constraint for now or using it.
    // Let's try deleting replies first.
    const { error: repliesError } = await supabaseAdmin
        .from('ticket_replies')
        .delete()
        .eq('ticket_id', id);
    
    if (repliesError) return NextResponse.json({ error: sanitizeErrorMessage(repliesError.message) }, { status: 500 });

    // Delete ticket
    const { error: deleteError } = await supabaseAdmin
        .from('support_tickets')
        .delete()
        .eq('id', id);

    if (deleteError) return NextResponse.json({ error: sanitizeErrorMessage(deleteError.message) }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}
