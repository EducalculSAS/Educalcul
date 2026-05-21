import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

// Initialize Supabase Admin Client

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Auth ID is required" }, { status: 400 });
    }

    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(id);

    if (error) {
       console.error("Error fetching auth user:", error);
       return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Determine if user has a Google identity
    const hasGoogle = user.identities?.some(id => id.provider === 'google') || false;

    // Fetch additional info from public.users
    const { data: publicUser } = await supabaseAdmin
      .from("users")
      .select("last_login_city, last_login_country, latitude, longitude, user_agent, device_type, last_active_at")
      .eq("auth_id", id)
      .maybeSingle();

    return NextResponse.json({
        last_sign_in_at: user.last_sign_in_at,
        created_at: user.created_at,
        has_google: hasGoogle,
        email_confirmed_at: user.email_confirmed_at,
        phone: user.phone,
        identities: user.identities?.map(id => id.provider) || [],
        geo: publicUser ? {
            city: publicUser.last_login_city,
            country: publicUser.last_login_country,
            lat: publicUser.latitude,
            lng: publicUser.longitude,
            user_agent: publicUser.user_agent,
            device_type: publicUser.device_type,
            last_active: publicUser.last_active_at
        } : null
    });

  } catch (error: any) {
    console.error("Error in auth-info API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
