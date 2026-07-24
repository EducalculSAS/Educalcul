import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { stripHtml } from "@/lib/stripHtml";


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
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const config = RATE_LIMITS["forum:post"];
    const rl = rateLimitWithBackoff(`forum:post:${me.authId}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de sujets créés, réessaie plus tard." }, { status: 429 });
    }

    const body = await req.json();
    const { title, content, categoryId } = body;

    const { data, error } = await supabaseAdmin
      .from("forum_posts")
      .insert({
        title: stripHtml(title),
        content: stripHtml(content),
        category_id: categoryId,
        author_id: me.id, // author is always the authenticated caller
      })
      .select(`
        *,
        author:users(first_name, last_name, child_username, role, avatar)
      `)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}
