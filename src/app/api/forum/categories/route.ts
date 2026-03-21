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

// GET: Fetch all categories with basic post counts
export async function GET(req: Request) {
  try {
    const { data: categories, error } = await supabaseAdmin
      .from("forum_categories")
      .select(`
        *,
        forum_posts (count)
      `)
      .order("order_index", { ascending: true });

    if (error) throw error;

    return NextResponse.json(categories);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new category (Admin only conceptually, enforced here playfully or by UI)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description, icon, orderIndex } = body;

    const { data, error } = await supabaseAdmin
      .from("forum_categories")
      .insert({
        name,
        description,
        icon: icon || 'MessageSquare',
        order_index: orderIndex || 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
