import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser, type AuthenticatedUser } from "@/lib/apiAuth";
import { COMMENT_MAX, cleanText, loadVisiblePost, parseId } from "@/lib/forum";

/** Réponse modifiable par son auteur ou un admin, dans un sujet visible. */
async function ownComment(
  me: AuthenticatedUser,
  rawId: string,
): Promise<{ status: 403 | 404 } | { comment: { id: number; post_id: number; author_id: number | null } }> {
  const id = parseId(rawId);
  if (!id) return { status: 404 };
  const { data: comment } = await supabaseAdmin
    .from("forum_comments")
    .select("id, post_id, author_id")
    .eq("id", id)
    .maybeSingle();
  if (!comment || !(await loadVisiblePost(me, comment.post_id))) return { status: 404 };
  if (me.role !== "admin" && comment.author_id !== me.id) return { status: 403 };
  return { comment };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const res = await ownComment(me, (await params).id);
    if (!("comment" in res)) return NextResponse.json({ error: "Action impossible" }, { status: res.status });

    const content = cleanText((await req.json().catch(() => ({}))).content, COMMENT_MAX);
    if (content.length < 1) return NextResponse.json({ error: "Réponse vide." }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("forum_comments")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", res.comment.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const res = await ownComment(me, (await params).id);
    if (!("comment" in res)) return NextResponse.json({ error: "Action impossible" }, { status: res.status });

    const { error } = await supabaseAdmin.from("forum_comments").delete().eq("id", res.comment.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
