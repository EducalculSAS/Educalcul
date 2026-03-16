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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch topic details
    const { data: topic, error: topicError } = await supabaseAdmin
      .from("forum_topics")
      .select("*")
      .eq("id", id)
      .single();

    if (topicError) throw topicError;

    // Fetch posts for this topic
    const { data: posts, error: postsError } = await supabaseAdmin
      .from("forum_posts")
      .select("*")
      .eq("topic_id", id)
      .order("created_at", { ascending: true });

    if (postsError) throw postsError;

    // Get all user IDs (topic author + post authors)
    const userIds = new Set<number>();
    if (topic.user_id) userIds.add(topic.user_id);
    posts.forEach((p: any) => {
      if (p.user_id) userIds.add(p.user_id);
    });

    // Fetch user emails
    let userMap: Record<number, string> = {};
    if (userIds.size > 0) {
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("id, email")
        .in("id", Array.from(userIds));

      if (users) {
        users.forEach((u: any) => {
          userMap[u.id] = u.email;
        });
      }
    }

    const result = {
      ...topic,
      user_email: userMap[topic.user_id] || "Inconnu",
      posts: posts.map((post: any) => ({
        ...post,
        user_email: post.user_id ? userMap[post.user_id] || "Admin" : "Admin",
      })),
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching topic details:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete topic (cascade should handle posts if set up, otherwise manual delete)
    // In our schema: topic_id bigint REFERENCES public.forum_topics(id) ON DELETE CASCADE

    const { error } = await supabaseAdmin
      .from("forum_topics")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting topic:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
