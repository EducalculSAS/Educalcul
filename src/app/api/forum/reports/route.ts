import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { stripHtml } from "@/lib/stripHtml";

/** Signalement d'un post ou d'un commentaire. Avant, l'INSERT partait du
 * navigateur (`supabase.from("forum_reports").insert(...)`) avec un reporter_id
 * fourni par le client. Ici reporter_id = l'appelant authentifié, cible et
 * type validés serveur. */
export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const config = RATE_LIMITS["forum:comment"];
    const rl = await rateLimitWithBackoff(`forum:report:${me.authId}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de signalements, réessaie plus tard." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const type = ["post", "comment", "profile"].includes(body.type) ? body.type : null;
    const targetId = Number(body.targetId);
    const reason = typeof body.reason === "string" ? stripHtml(body.reason).trim().slice(0, 1000) : "";

    if (!type || !Number.isFinite(targetId) || !reason) {
      return NextResponse.json({ error: "Signalement incomplet" }, { status: 400 });
    }

    // Résout l'utilisateur signalé côté serveur (jamais une valeur du client).
    let reportedUserId: number | null = null;
    if (type === "profile") {
      const { data: u } = await supabaseAdmin.from("users").select("id").eq("id", targetId).maybeSingle();
      if (!u) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
      reportedUserId = u.id;
    } else {
      const table = type === "post" ? "forum_posts" : "forum_comments";
      const { data: target } = await supabaseAdmin.from(table).select("author_id").eq("id", targetId).maybeSingle();
      if (!target) return NextResponse.json({ error: "Contenu introuvable" }, { status: 404 });
      reportedUserId = target.author_id;
    }

    const { error } = await supabaseAdmin.from("forum_reports").insert({
      reporter_id: me.id,
      reported_user_id: reportedUserId,
      post_id: type === "post" ? targetId : null,
      comment_id: type === "comment" ? targetId : null,
      reason,
      status: "pending",
    });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
