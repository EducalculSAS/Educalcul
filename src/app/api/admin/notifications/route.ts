import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";

/** Notifications admin non lues du destinataire connecté (ban, reactivation,
 * message envoye par un admin) — le destinataire est n'importe quel role
 * (parent/enfant/admin), PAS forcement un admin : requireRole(admin) ici
 * empechait un parent/enfant banni ou contacte de jamais voir le message. La
 * requete est deja scopee a user_id = me.id, donc ouvrir a tout utilisateur
 * authentifie reste sur — chacun ne voit que ses propres notifications. */
export async function GET(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("admin_notifications")
      .select("id, type, title, content, is_read, created_at")
      .eq("user_id", me.id)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}

/** Marque une notification comme lue (uniquement une des siennes). */
export async function PATCH(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await req.json().catch(() => ({}));
    if (!Number.isFinite(Number(id))) {
      return NextResponse.json({ error: "id invalide" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("admin_notifications")
      .update({ is_read: true })
      .eq("id", Number(id))
      .eq("user_id", me.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}
