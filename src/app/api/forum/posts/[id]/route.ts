import { NextResponse } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { notify } from "@/lib/notify";
import {
  AUTHOR_COLUMNS, CONTENT_MAX, TITLE_MAX, TITLE_MIN,
  cleanText, loadVisiblePost, parseId, publicAuthor, threadLink,
} from "@/lib/forum";
import type { ForumComment, ForumThread } from "@/lib/forumTypes";

const MAX_COMMENTS = 500;

/** Un sujet complet : message, réponses, j'aime et suivi de l'utilisateur. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const id = parseId((await params).id);
    const visible = id ? await loadVisiblePost(me, id) : null;
    if (!id || !visible) return NextResponse.json({ error: "Sujet introuvable" }, { status: 404 });

    const [{ data: post, error }, { data: comments }, { data: follow }] = await Promise.all([
      supabaseAdmin
        .from("forum_posts")
        .select(`id, title, content, author_id, is_pinned, is_locked, solved_comment_id, like_count, view_count, comment_count, created_at, updated_at,
                 category:forum_categories!category_id(id, name, color),
                 author:user_public_profiles!author_id(${AUTHOR_COLUMNS})`)
        .eq("id", id)
        .single(),
      supabaseAdmin
        .from("forum_comments")
        .select(`id, content, author_id, created_at, updated_at, like_count, quoted_comment_id,
                 author:user_public_profiles!author_id(${AUTHOR_COLUMNS})`)
        .eq("post_id", id)
        .order("created_at", { ascending: true })
        .limit(MAX_COMMENTS),
      supabaseAdmin.from("forum_follows").select("post_id").eq("user_id", me.id).eq("post_id", id).maybeSingle(),
    ]);
    if (error || !post) throw error ?? new Error("Sujet introuvable");

    const commentRows = (comments ?? []) as any[];
    const commentIds = commentRows.map((c) => c.id);
    const likeFilter = commentIds.length
      ? `post_id.eq.${id},comment_id.in.(${commentIds.join(",")})`
      : `post_id.eq.${id}`;
    const { data: myLikes } = await supabaseAdmin
      .from("forum_likes")
      .select("post_id, comment_id")
      .eq("user_id", me.id)
      .or(likeFilter);
    const likedComments = new Set((myLikes ?? []).map((l) => l.comment_id).filter(Boolean));
    const likedPost = (myLikes ?? []).some((l) => l.post_id === id);

    const byId = new Map(commentRows.map((c) => [c.id, c]));
    const isAdmin = me.role === "admin";
    const p = post as any;

    const thread: ForumThread = {
      id: p.id,
      title: p.title,
      content: p.content,
      category: p.category ? { id: p.category.id, name: p.category.name, color: p.category.color } : null,
      author: publicAuthor(p.author),
      is_pinned: !!p.is_pinned,
      is_locked: !!p.is_locked,
      solved_comment_id: p.solved_comment_id,
      like_count: p.like_count ?? 0,
      view_count: p.view_count ?? 0,
      comment_count: p.comment_count ?? 0,
      created_at: p.created_at,
      updated_at: p.updated_at,
      liked: likedPost,
      following: !!follow,
      canEdit: isAdmin || p.author_id === me.id,
      canModerate: isAdmin,
      canMarkSolution: isAdmin || p.author_id === me.id,
      comments: commentRows.map((c): ForumComment => {
        const quoted = c.quoted_comment_id ? byId.get(c.quoted_comment_id) : null;
        return {
          id: c.id,
          content: c.content,
          author: publicAuthor(c.author),
          created_at: c.created_at,
          updated_at: c.updated_at,
          like_count: c.like_count ?? 0,
          liked: likedComments.has(c.id),
          quoted: quoted
            ? {
                id: quoted.id,
                excerpt: String(quoted.content || "").replace(/\s+/g, " ").slice(0, 160),
                authorName: publicAuthor(quoted.author)?.displayName ?? "Utilisateur",
              }
            : null,
          canEdit: isAdmin || c.author_id === me.id,
        };
      }),
    };
    return NextResponse.json(thread);
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const id = parseId((await params).id);
    const post = id ? await loadVisiblePost(me, id) : null;
    if (!id || !post) return NextResponse.json({ error: "Sujet introuvable" }, { status: 404 });
    if (me.role !== "admin" && post.author_id !== me.id) {
      return NextResponse.json({ error: "Interdit" }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from("forum_posts").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}

/**
 * Modifier un sujet :
 *  - titre / message : auteur ou admin ;
 *  - épingler / verrouiller : admin ;
 *  - meilleure réponse (solved_comment_id) : auteur ou admin, et la réponse
 *    doit appartenir à CE sujet.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const id = parseId((await params).id);
    const post = id ? await loadVisiblePost(me, id) : null;
    if (!id || !post) return NextResponse.json({ error: "Sujet introuvable" }, { status: 404 });

    const isAdmin = me.role === "admin";
    const isAuthor = post.author_id === me.id;
    if (!isAdmin && !isAuthor) return NextResponse.json({ error: "Interdit" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) {
      const title = cleanText(body.title, TITLE_MAX).replace(/\n+/g, " ");
      if (title.length < TITLE_MIN) return NextResponse.json({ error: "Titre trop court." }, { status: 400 });
      updates.title = title;
    }
    if (body.content !== undefined) {
      const content = cleanText(body.content, CONTENT_MAX);
      if (content.length < 2) return NextResponse.json({ error: "Message vide." }, { status: 400 });
      updates.content = content;
    }
    if (updates.title !== undefined || updates.content !== undefined) updates.updated_at = new Date().toISOString();

    if (isAdmin && typeof body.is_pinned === "boolean") updates.is_pinned = body.is_pinned;
    if (isAdmin && typeof body.is_locked === "boolean") updates.is_locked = body.is_locked;

    let newSolution: { id: number; author_id: number | null } | null = null;
    if (body.solved_comment_id !== undefined) {
      if (body.solved_comment_id === null) updates.solved_comment_id = null;
      else {
        const commentId = parseId(body.solved_comment_id);
        const { data: comment } = commentId
          ? await supabaseAdmin.from("forum_comments").select("id, post_id, author_id").eq("id", commentId).maybeSingle()
          : { data: null };
        if (!comment || comment.post_id !== id) {
          return NextResponse.json({ error: "Réponse introuvable dans ce sujet." }, { status: 400 });
        }
        updates.solved_comment_id = comment.id;
        newSolution = comment;
      }
    }

    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });

    const { error } = await supabaseAdmin.from("forum_posts").update(updates).eq("id", id);
    if (error) throw error;

    // Prévenir l'auteur de la réponse retenue (sauf s'il l'a choisie lui-même).
    if (newSolution?.author_id && newSolution.author_id !== me.id && newSolution.id !== post.solved_comment_id) {
      const { data: target } = await supabaseAdmin
        .from("users")
        .select("auth_id, role")
        .eq("id", newSolution.author_id)
        .maybeSingle();
      if (target?.auth_id) {
        await notify({
          userId: target.auth_id,
          type: "forum_solution",
          title: "Ta réponse a été choisie comme solution",
          link: threadLink(target.role, id),
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}
