import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";

export async function POST(request: Request) {
  try {
    // Identity comes from the verified JWT, never from the request body.
    const requester = await requireRole(request, ["parent", "admin"]);
    if (!requester) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { childId, password, newUsername } = body;

    if (!childId || (!password && !newUsername)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. Verify the requester owns the child (admins may manage any child)
    let childQuery = supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", childId)
      .eq("role", "child");
    if (requester.role !== "admin") {
      childQuery = childQuery.eq("parent_id", requester.id);
    }
    const { data: childUser, error: childError } = await childQuery.single();

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
      // Update existing auth user password and/or email
      const updates: { password?: string; email?: string; email_confirm?: boolean } = {};
      if (password) updates.password = password;
      if (newUsername) {
        updates.email = `${newUsername}@educalcul.user`;
        updates.email_confirm = true;
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        authUserId,
        updates
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

    if (!authUserId && password) {
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
