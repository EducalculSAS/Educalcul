import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier, password } = body;

    let email = identifier;
    if (!email.includes("@")) {
      email = `${email}@educalcul.user`;
    }

    // Initialize Supabase Admin Client
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

    // 1. Try standard login first
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInError && signInData.session) {
      return NextResponse.json({ session: signInData.session }, { status: 200 });
    }

    // 2. If login failed, check if it's an orphan child account
    // Only proceed if the identifier looks like a username
    const isChildLogin = !identifier.includes("@") || identifier.endsWith("@educalcul.user");
    
    if (isChildLogin) {
      const username = identifier.split("@")[0];
      
      // Check public.users for this child (Service Role bypasses RLS)
      const { data: childUser } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("child_username", username)
        .eq("role", "child")
        .single();
        
      // If we found a child user who EITHER has no auth_id OR has an auth_id but login failed (maybe auth user missing/deleted)
      if (childUser) {
        // Check if the Auth user actually exists
        let authUserExists = false;
        if (childUser.auth_id) {
            const { data: existingAuth } = await supabaseAdmin.auth.admin.getUserById(childUser.auth_id);
            if (existingAuth && existingAuth.user) {
                authUserExists = true;
            }
        }

        if (!authUserExists) {
            console.log(`Fixing orphan child account: ${username}`);
            
            // Create the Auth User
            const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                role: "child",
                first_name: childUser.first_name,
                last_name: childUser.last_name,
            },
            });
            
            if (!createError && createdUser.user) {
                // Link the new auth_id to public.users
                await supabaseAdmin
                .from("users")
                .update({ auth_id: createdUser.user.id })
                .eq("id", childUser.id);
                
                // Retry login
                const { data: retryData, error: retryError } = await supabaseAdmin.auth.signInWithPassword({
                email,
                password,
                });
                
                if (!retryError && retryData.session) {
                return NextResponse.json({ session: retryData.session, fixed: true }, { status: 200 });
                }
            }
        }
      }
    }

    // Return the original error
    return NextResponse.json({ error: signInError?.message || "Login failed" }, { status: 400 });

  } catch (error: any) {
    console.error("Login helper error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
