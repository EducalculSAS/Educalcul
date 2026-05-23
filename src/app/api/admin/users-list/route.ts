import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, auth_id, email, first_name, last_name, role")
    .order("first_name");
  if (error) return NextResponse.json([], { status: 500 });
  return NextResponse.json(data);
}
