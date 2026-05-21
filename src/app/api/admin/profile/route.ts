import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";


export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      auth_id,
      first_name,
      last_name,
      email,
      avatar,
      child_username,
      name_animation,
      avatar_border,
    } = body;

    if (!auth_id) {
      return NextResponse.json({ error: "Auth ID is required" }, { status: 400 });
    }

    // Map CSS class names → badge system keys (used by forum, profiles, etc.)
    const rawBorderKey = avatar_border ? avatar_border.replace(/^border-/, "") : "admin";
    // Guard: never allow "none" or "default" for admin — always keep a valid key
    const borderKey = (!rawBorderKey || rawBorderKey === "none") ? "admin" : rawBorderKey;
    const nameColorMap: Record<string, string> = {
      "text-admin":           "admin",
      "name-elite":           "elite",
      "name-flame":           "flame",
      "name-pro-animated":    "pro",
      "name-purple-animated": "premium",
      "name-teal-animated":   "famille",
      "name-diamond-animated":"diamond",
      "name-gold-animated":   "gold",
      "name-silver-animated": "silver",
      "name-bronze-animated": "bronze",
      "text-basic":           "default",
    };
    const rawColorKey = nameColorMap[name_animation] ?? "admin";
    const nameColorKey = (!rawColorKey || rawColorKey === "default") ? "admin" : rawColorKey;

    // Update public.users — write to BOTH column systems so forum & profile stay in sync
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        first_name,
        last_name,
        email,
        child_username,
        avatar,
        name_animation,
        avatar_border,
        equipped_border: borderKey,   // used by forum, badge page, public profiles
        name_color: nameColorKey,     // used by forum, badge page, public profiles
        updated_at: new Date().toISOString(),
      })
      .eq("auth_id", auth_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Update Auth email if provided and different
    // Note: This might trigger email confirmation flow depending on Supabase settings.
    if (email) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(auth_id, {
        email: email,
        user_metadata: {
            first_name,
            last_name
        }
      });
      
      if (authError) {
        console.error("Error updating auth user:", authError);
        // We don't fail the whole request if auth update fails (e.g. rate limit or same email)
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
