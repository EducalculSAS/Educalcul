import { NextResponse } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { notify } from "@/lib/notify";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { COMMENT_MAX, cleanText, loadVisiblePost, parseId, threadLink } from "@/lib/forum";

/**
 * Répondre à un sujet. Refusé si le sujet est verrouillé (sauf admin) ou hors
 * du public de l'utilisateur. Prévient l'auteur et les abonnés du sujet.
 */
export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const config = RATE_LIMITS["forum:comment"];
    const rl = await rateLimitWithBackoff(`forum:comment:${me.authId}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de réponses, réessaie plus tard." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const postId = parseId(body.postId);
    const content = cleanText(body.content, COMMENT_MAX);
    const quotedId = body.quotedCommentId != null ? parseId(body.quotedCommentId) : null;

    const post = postId ? await loadVisiblePost(me, postId) : null;
    if (!postId || !post) return NextResponse.json({ error: "Sujet introuvable" }, { status: 404 });
    if (post.is_locked && me.role !== "admin") {
      return NextResponse.json({ error: "Ce sujet est verrouillé." }, { status: 403 });
    }
    if (content.length < 1) return NextResponse.json({ error: "Écris ta réponse." }, { status: 400 });

    // Une citation ne peut viser qu'une réponse du même sujet.
    let quoted_comment_id: number | null = null;
    if (quotedId) {
      const { data: q } = await supabaseAdmin.from("forum_comments").select("id, post_id").eq("id", quotedId).maybeSingle();
      if (q && q.post_id === postId) quoted_comment_id = q.id;
    }

    const { data, error } = await supabaseAdmin
      .from("forum_comments")
      .insert({ post_id: postId, content, author_id: me.id, quoted_comment_id })
      .select("id")
      .single();
    if (error) throw error;

    // Répondre, c'est suivre le sujet. Puis prévenir l'auteur et les abonnés.
    const [, { data: me2 }, { data: followers }, { data: postRow }] = await Promise.all([
      supabaseAdmin.from("forum_follows").upsert({ user_id: me.id, post_id: postId }, { onConflict: "user_id,post_id", ignoreDuplicates: true }),
      supabaseAdmin.from("user_public_profiles").select("first_name, child_username, role").eq("id", me.id).maybeSingle(),
      supabaseAdmin.from("forum_follows").select("user:users!user_id(id, auth_id, role)").eq("post_id", postId).neq("user_id", me.id).limit(200),
      supabaseAdmin.from("forum_posts").select("title").eq("id", postId).maybeSingle(),
    ]);
    const who = me2?.role === "child" ? me2.child_username || me2.first_name : me2?.first_name;
    for (const f of followers ?? []) {
      const u = (f as { user?: unknown }).user as { id: number; auth_id: string; role: string } | null;
      if (!u?.auth_id) continue;
      await notify({
        userId: u.auth_id,
        type: "forum_reply",
        title: `${who || "Quelqu'un"} a répondu à « ${String(postRow?.title || "un sujet").slice(0, 60)} »`,
        body: content.slice(0, 100),
        link: threadLink(u.role, postId),
      });
    }

    return NextResponse.json({ id: data.id });
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}
