import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { content, user_id } = await request.json();

    let publicUserId = null;

    // If user_id (Auth ID) is provided, try to find the corresponding public user ID
    if (user_id) {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("auth_id", user_id)
        .single();

      if (user) {
        publicUserId = user.id;
      }
    }

    const { data, error } = await supabaseAdmin
      .from("forum_posts")
      .insert({
        topic_id: id,
        content: content,
        user_id: publicUserId, // Will be null if not found (displayed as Admin) or the found ID
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error posting reply:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
