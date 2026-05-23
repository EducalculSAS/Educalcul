import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { notify } from "@/lib/notify";

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { postId, content, authId } = body;

    const { data: userRecord, error: userError } = await supabaseAdmin
      .from("users").select("id").eq("auth_id", authId).maybeSingle();

    if (userError || !userRecord) throw new Error("User not found");

    const { data, error } = await supabaseAdmin
      .from("forum_comments")
      .insert({ post_id: postId, content, author_id: userRecord.id })
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
    if (postAuthorAuthId && postAuthorAuthId !== authId) {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
