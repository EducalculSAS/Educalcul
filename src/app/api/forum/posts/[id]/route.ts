import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";


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
    const body = await req.json();
    const updates: any = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.content !== undefined) updates.content = body.content;
    if (body.is_pinned !== undefined) updates.is_pinned = body.is_pinned;
    if (body.is_locked !== undefined) updates.is_locked = body.is_locked;
    
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
