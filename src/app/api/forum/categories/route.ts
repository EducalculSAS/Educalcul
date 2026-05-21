import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";


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
