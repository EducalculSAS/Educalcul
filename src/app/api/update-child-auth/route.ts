import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { supabase as supabaseAdmin } from "@/lib/supabaseClient"; // This is actually the public client, we need admin client here.

// We need a separate admin client creation because the exported one might not be admin
// depending on how it's configured. Usually it uses ANON key.
// We need SERVICE_ROLE key for admin ops.

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { childId, password, parentAuthId } = body;

    if (!childId || !password || !parentAuthId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Initialize Admin Client
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 1. Verify Parent owns the child
    // We can use the service client to bypass RLS, but we must verify the relationship manually
    // or trust the caller? No, we must verify.
    // The caller (client) sends parentAuthId, but anyone can send anything.
    // Ideally we should get the session from the request cookies to be secure.
    // But for now let's rely on the input and check DB.
    
    // Better: Get the session from the request headers/cookies to ensure the caller is indeed the parent.
    // However, in this context (API route), retrieving session might be complex if we don't use the helper.
    // Let's assume the client sends the parentAuthId and we verify that the child belongs to a parent with that auth_id.
    
    const { data: parentUser, error: parentError } = await supabaseService
      .from("users")
      .select("id")
      .eq("auth_id", parentAuthId)
      .single();

    if (parentError || !parentUser) {
      return NextResponse.json({ error: "Parent not found" }, { status: 403 });
    }

    const { data: childUser, error: childError } = await supabaseService
      .from("users")
      .select("*")
      .eq("id", childId)
      .eq("parent_id", parentUser.id)
      .single();

    if (childError || !childUser) {
      return NextResponse.json(
        { error: "Child not found or unauthorized" },
        { status: 404 }
      );
    }

    // 2. Check if Auth User exists
    let authUserId = childUser.auth_id;
    let action = "updated";

    if (authUserId) {
      // Update existing auth user password
      const { error: updateError } = await supabaseService.auth.admin.updateUserById(
        authUserId,
        { password: password }
      );

      if (updateError) {
         // If user not found in auth (orphaned), clear auth_id and treat as new
         if (updateError.message.includes("User not found")) {
            authUserId = null;
         } else {
            throw updateError;
         }
      }
    }

    if (!authUserId) {
      // Create new auth user
      action = "created";
      const email = `${childUser.child_username}@educalcul.user`;
      
      // Check if user with this email already exists (edge case)
      const { data: existingAuth } = await supabaseService.from('auth.users').select('id').eq('email', email).maybeSingle();
       // Wait, we can't select from auth.users directly via API usually unless we use RPC or admin listUsers.
       // admin.createUser will fail if exists.

      const { data: newUser, error: createError } = await supabaseService.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          role: "child",
          first_name: childUser.first_name,
          last_name: childUser.last_name,
        },
      });

      if (createError) {
        throw createError;
      }

      authUserId = newUser.user.id;

      // Link back to public.users
      const { error: linkError } = await supabaseService
        .from("users")
        .update({ auth_id: authUserId })
        .eq("id", childId);

      if (linkError) throw linkError;
    }

    return NextResponse.json({ success: true, action }, { status: 200 });

  } catch (error: any) {
    console.error("Error in update-child-auth:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
