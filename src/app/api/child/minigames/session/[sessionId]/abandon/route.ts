import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";

/** Annule une partie de mini-jeu en cours (bouton "retour" pendant le jeu) :
 * supprime la session tant qu'elle n'est pas déjà terminée, pour qu'elle ne
 * compte pas dans la limite quotidienne de parties et que le jeu reste
 * rejouable au prochain "Jouer". Partagé par tous les jeux (mathador +
 * jeux à paliers), la table minigame_sessions étant commune. Idempotent et
 * silencieux si la session n'existe pas / appartient à quelqu'un d'autre /
 * est déjà terminée — un abandon qui échoue silencieusement n'est pas grave,
 * contrairement à un abandon qui supprimerait une partie déjà comptée.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { sessionId } = await params;

    const { data: user } = await supabaseAdmin.from("users").select("id").eq("auth_id", me.authId).maybeSingle();
    if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    await supabaseAdmin
      .from("minigame_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .neq("status", "completed");

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
