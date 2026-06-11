import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const { username } = await request.json();
    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "Missing username" }, { status: 400 });
    }

    const { data: childUser } = await supabaseAdmin
      .from("users")
      .select("auth_id")
      .eq("child_username", username.trim())
      .maybeSingle();

    if (!childUser?.auth_id) {
      return NextResponse.json({ email: `${username.trim()}@educalcul.user` });
    }

    const { data: authUser, error } = await supabaseAdmin.auth.admin.getUserById(childUser.auth_id);
    if (error || !authUser?.user?.email) {
      return NextResponse.json({ email: `${username.trim()}@educalcul.user` });
    }

    return NextResponse.json({ email: authUser.user.email });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
