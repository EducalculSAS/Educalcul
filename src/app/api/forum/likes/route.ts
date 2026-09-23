import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { loadVisiblePost, parseId } from "@/lib/forum";

/** Aimer / ne plus aimer un sujet OU une réponse. Renvoie le nouvel état. */
export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const cfg = RATE_LIMITS["forum:like"];
    const rl = await rateLimitWithBackoff(`forum:like:${me.id}`, cfg.maxAttempts, cfg.windowMs);
    if (!rl.allowed) return NextResponse.json({ error: "Doucement !" }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const postId = body.postId != null ? parseId(body.postId) : null;
    const commentId = body.commentId != null ? parseId(body.commentId) : null;
    if (!postId === !commentId) return NextResponse.json({ error: "Cible invalide" }, { status: 400 });

    // La cible doit appartenir à un sujet visible par l'utilisateur.
    let threadId = postId;
    if (commentId) {
      const { data: c } = await supabaseAdmin.from("forum_comments").select("post_id").eq("id", commentId).maybeSingle();
      threadId = c?.post_id ?? null;
    }
    if (!threadId || !(await loadVisiblePost(me, threadId))) {
      return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    }

    const column = postId ? "post_id" : "comment_id";
    const target = (postId ?? commentId)!;

    const { data: removed, error: delError } = await supabaseAdmin
      .from("forum_likes")
      .delete()
      .eq("user_id", me.id)
      .eq(column, target)
      .select("id");
    if (delError) throw delError;

    let liked = false;
    if (!removed?.length) {
      const { error } = await supabaseAdmin.from("forum_likes").insert({ user_id: me.id, [column]: target });
      // Double clic concurrent : l'index unique a déjà enregistré le j'aime.
      if (error && error.code !== "23505") throw error;
      liked = true;
    }

    const { data: row } = await supabaseAdmin
      .from(postId ? "forum_posts" : "forum_comments")
      .select("like_count")
      .eq("id", target)
      .maybeSingle();
    return NextResponse.json({ liked, like_count: row?.like_count ?? 0 });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
