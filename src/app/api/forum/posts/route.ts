import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";


export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");

    let query = supabaseAdmin
      .from("forum_posts")
      .select(`
        *,
        author:users(first_name, last_name, child_username, role, avatar),
        comments:forum_comments(count)
      `)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, content, categoryId, authId } = body;

    const { data: userRecord, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", authId)
      .maybeSingle();

    if (userError || !userRecord) throw new Error("User not found");

    const { data, error } = await supabaseAdmin
      .from("forum_posts")
      .insert({
        title,
        content,
        category_id: categoryId,
        author_id: userRecord.id,
      })
      .select(`
        *,
        author:users(first_name, last_name, child_username, role, avatar)
      `)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
