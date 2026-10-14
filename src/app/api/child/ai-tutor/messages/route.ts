import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";

/** Historique de conversation Calia (tuteur IA), persisté côté serveur — plus
 * de localStorage (données potentiellement sensibles d'un enfant, sans
 * politique de rétention ni contrôle possible côté serveur auparavant). Une
 * conversation par "contexte" (cours/exercice/quiz/support), comme avant. */
export async function GET(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const contextKey = searchParams.get("contextKey");
    if (!contextKey) return NextResponse.json({ error: "contextKey requis" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("ai_tutor_messages")
      .select("role, content")
      .eq("user_id", me.id)
      .eq("context_key", contextKey)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
    return NextResponse.json({ messages: data || [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}

/** "Nouvelle conversation" — supprime l'historique de ce contexte pour cet élève. */
export async function DELETE(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const contextKey = searchParams.get("contextKey");
    if (!contextKey) return NextResponse.json({ error: "contextKey requis" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("ai_tutor_messages")
      .delete()
      .eq("user_id", me.id)
      .eq("context_key", contextKey);

    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
