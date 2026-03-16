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

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { 
      auth_id, 
      first_name, 
      last_name, 
      email, 
      avatar, 
      name_animation, 
      avatar_border 
    } = body;

    if (!auth_id) {
      return NextResponse.json({ error: "Auth ID is required" }, { status: 400 });
    }

    // Update public.users
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        first_name,
        last_name,
        email,
        avatar,
        name_animation,
        avatar_border,
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
