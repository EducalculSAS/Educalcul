import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";

// Returns the authenticated user if they are the author of post `id` or an admin.
async function authorOrAdmin(req: Request, postId: string) {
  const me = await getAuthenticatedUser(req);
  if (!me) return { ok: false as const, status: 401 };
  if (me.role === "admin") return { ok: true as const, me };
  const { data: post } = await supabaseAdmin
    .from("forum_posts")
    .select("author_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return { ok: false as const, status: 404 };
  if (post.author_id !== me.id) return { ok: false as const, status: 403 };
  return { ok: true as const, me };
}


export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin
      .from("forum_posts")
      .select(`
        *,
        author:users(first_name, last_name, child_username, role, avatar),
        category:forum_categories(name)
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await authorOrAdmin(req, id);
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });

    const { error } = await supabaseAdmin.from("forum_posts").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await authorOrAdmin(req, id);
    if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });

    const body = await req.json();
    const updates: any = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.content !== undefined) updates.content = body.content;
    // Pin/lock are moderation actions: admins only.
    if (body.is_pinned !== undefined && auth.me.role === "admin") updates.is_pinned = body.is_pinned;
    if (body.is_locked !== undefined && auth.me.role === "admin") updates.is_locked = body.is_locked;

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("forum_posts")
      .update(updates)
      .eq("id", id)
      .select(`
        *,
        author:users(first_name, last_name, child_username, role, avatar),
        category:forum_categories(name)
      `)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
