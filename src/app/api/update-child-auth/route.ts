import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

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

    // 1. Verify Parent owns the child
    const { data: parentUser, error: parentError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", parentAuthId)
      .single();

    if (parentError || !parentUser) {
      return NextResponse.json({ error: "Parent not found" }, { status: 403 });
    }

    const { data: childUser, error: childError } = await supabaseAdmin
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
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
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
      const { data: existingAuth } = await supabaseAdmin.from('auth.users').select('id').eq('email', email).maybeSingle();
       // Wait, we can't select from auth.users directly via API usually unless we use RPC or admin listUsers.
       // admin.createUser will fail if exists.

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
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
      const { error: linkError } = await supabaseAdmin
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
