import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE!
);

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { data, error } = await supabaseAdmin
      .from("forum_posts")
      .select(`
        *,
        author:users(first_name, last_name, child_username, role, avatar),
        category:forum_categories(name)
      `)
      .eq("id", params.id)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabaseAdmin.from("forum_posts").delete().eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
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
      .eq("id", params.id)
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
