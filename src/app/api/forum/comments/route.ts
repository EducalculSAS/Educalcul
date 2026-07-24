import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { notify } from "@/lib/notify";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { stripHtml } from "@/lib/stripHtml";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get("postId");
    if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("forum_comments")
      .select(`*, author:users(first_name, last_name, child_username, role, avatar)`)
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const config = RATE_LIMITS["forum:comment"];
    const rl = rateLimitWithBackoff(`forum:comment:${me.authId}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de commentaires, réessaie plus tard." }, { status: 429 });
    }

    const body = await req.json();
    const { postId, content } = body;

    const { data, error } = await supabaseAdmin
      .from("forum_comments")
      .insert({ post_id: postId, content: stripHtml(content), author_id: me.id }) // author = caller
      .select(`*, author:users(first_name, last_name, child_username, role, avatar)`)
      .single();

    if (error) throw error;

    // Notifier l'auteur du post si différent du commentateur
    const { data: post } = await supabaseAdmin
      .from("forum_posts")
      .select("title, author:users!author_id(auth_id)")
      .eq("id", postId)
      .maybeSingle();

    const postAuthorAuthId = (post?.author as any)?.auth_id;
    if (postAuthorAuthId && postAuthorAuthId !== me.authId) {
      const name = (data as any)?.author?.first_name || (data as any)?.author?.child_username || "Quelqu'un";
      notify({
        userId: postAuthorAuthId,
        type: "forum_reply",
        title: `${name} a répondu à votre post`,
        body: content?.slice(0, 80),
        link: `/child/forum/${postId}`,
      });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
