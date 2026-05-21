import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      role,
      firstName,
      lastName,
      email,
      password,
      childUsername,
      childAge,
      parentEmail,
      sessionId,
    } = await req.json();

    // Validate required fields
    if (!role || !firstName || !lastName || !email || !password || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Initialize admin client (only at runtime)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    // Create Supabase Auth user
    const signUpEmail = role === "child" 
      ? `${childUsername?.replace(/\s+/g, "").toLowerCase()}@educalcul.user`
      : email;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: signUpEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: role,
        child_username: childUsername || null,
        child_age: childAge || null,
        parent_email: parentEmail || null,
      },
    });

    if (authError) {
      console.error("Auth creation error:", authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 400 }
      );
    }

    // Create user record in public.users (trigger should handle this, but let's ensure it)
    const { error: userError } = await supabaseAdmin
      .from("users")
      .insert({
        auth_id: authData.user.id,
        first_name: firstName,
        last_name: lastName,
        email: signUpEmail,
        role: role,
        child_username: childUsername || null,
        child_age: childAge || null,
        parent_email: parentEmail || null,
      });

    if (userError && !userError.message.includes("duplicate")) {
      console.error("User record creation error:", userError);
      // Don't fail here - the trigger might have created it
    }

    // TODO: Link Stripe subscription to this user if sessionId was provided
    // This would involve querying Stripe for the session and linking the customer

    return NextResponse.json(
      {
        success: true,
        userId: authData.user.id,
        email: signUpEmail,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Account creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
