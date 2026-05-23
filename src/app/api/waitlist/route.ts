import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("waitlist")
      .insert({ email: email.trim().toLowerCase() });

    if (error) {
      if (error.message.includes("duplicate") || error.message.includes("unique")) {
        return NextResponse.json({ success: true, already: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
