import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("forum_categories")
      .select("*, forum_posts(count)")
      .order("order_index", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, description, icon, orderIndex } = await req.json();

    const { data, error } = await supabaseAdmin
      .from("forum_categories")
      .insert({
        name,
        description,
        icon: icon || "MessageSquare",
        order_index: orderIndex ?? 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
