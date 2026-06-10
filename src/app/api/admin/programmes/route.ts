import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("programme_pdfs")
    .select("*")
    .order("level");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { level, level_label, file_url, file_name } = body;
  if (!level || !file_url) {
    return NextResponse.json({ error: "level and file_url required" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("programme_pdfs")
    .upsert({ level, level_label, file_url, file_name }, { onConflict: "level" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, level_label, file_name } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("programme_pdfs")
    .update({ level_label, file_name })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  const { level } = await req.json();
  const { error } = await supabaseAdmin.from("programme_pdfs").delete().eq("level", level);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
