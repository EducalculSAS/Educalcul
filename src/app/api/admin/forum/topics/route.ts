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

export async function GET() {
  try {
    const { data: topics, error } = await supabaseAdmin
      .from("forum_topics")
      .select(
        `
        *,
        users:forum_topics_user_id_fkey (
          id,
          email
        ),
        forum_categories (
          name
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Get post counts and first post content for each topic
    const topicsWithDetails = await Promise.all(
      topics.map(async (topic) => {
        // Get post count
        const { count } = await supabaseAdmin
          .from("forum_posts")
          .select("*", { count: "exact", head: true })
          .eq("topic_id", topic.id);

        // Get first post content (OP)
        const { data: firstPost } = await supabaseAdmin
          .from("forum_posts")
          .select("content")
          .eq("topic_id", topic.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        return {
          ...topic,
          content: firstPost?.content || "", // Map content from first post
          user_id: topic.users?.id,
          user_email: topic.users?.email || "Inconnu",
          category: topic.forum_categories?.name || "Général",
          posts_count: count || 0,
        };
      })
    );

    return NextResponse.json(topicsWithDetails);
  } catch (error: any) {
    console.error("Error fetching forum topics:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, content, category, is_pinned, is_locked, user_auth_id } =
      body;

    // Validation
    if (!title || !content || !user_auth_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. Get Public User ID
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", user_auth_id)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 2. Get Category ID
    let categoryId = null;
    if (category) {
      const { data: cat } = await supabaseAdmin
        .from("forum_categories")
        .select("id")
        .eq("name", category)
        .single();

      if (cat) categoryId = cat.id;
    }

    // Default to 'Général' if not found
    if (!categoryId) {
      const { data: defaultCat } = await supabaseAdmin
        .from("forum_categories")
        .select("id")
        .eq("slug", "general")
        .single();
      categoryId = defaultCat?.id;
    }

    // 3. Create Topic
    const { data: topic, error: topicError } = await supabaseAdmin
      .from("forum_topics")
      .insert({
        title,
        category_id: categoryId,
        user_id: user.id,
        is_pinned: is_pinned || false,
        is_locked: is_locked || false,
        post_count: 1,
      })
      .select()
      .single();

    if (topicError) throw topicError;

    // 4. Create First Post
    const { error: postError } = await supabaseAdmin
      .from("forum_posts")
      .insert({
        topic_id: topic.id,
        content,
        user_id: user.id,
      });

    if (postError) {
      // Rollback topic creation if possible, or just log error
      // For simplicity, we'll throw and let the client handle the partial failure (or retry)
      // But we should probably delete the topic to avoid "empty" topics
      await supabaseAdmin.from("forum_topics").delete().eq("id", topic.id);
      throw postError;
    }

    return NextResponse.json(topic);
  } catch (error: any) {
    console.error("Error creating topic:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
