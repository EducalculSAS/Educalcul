import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

// Initialize Supabase Admin Client

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const status = searchParams.get("status");

    let query = supabaseAdmin
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (role && role !== "all") {
      query = query.eq("role", role);
    }
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName, role, status, gradeLevel, childAge } = body;

    // 1. Create User in Supabase Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role,
          first_name: firstName,
          last_name: lastName,
          grade_level: gradeLevel,
          child_age: childAge,
        },
      });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to create auth user" },
        { status: 500 }
      );
    }

    const authId = authData.user.id;

    // 2. Create User in public.users
    // Note: If you have a trigger that automatically creates a public.users entry on auth.users insert,
    // you should Update it instead of Insert.
    // However, usually triggers are for self-registration. For admin creation, explicit insert is safer if trigger checks for metadata.
    // Let's assume we might need to update or insert.
    // Best approach: Try to insert, if conflict (due to trigger), update.

    // Check if user exists (via trigger)
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", authId)
      .maybeSingle();

    if (existingUser) {
      // Update existing
      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          first_name: firstName,
          last_name: lastName,
          role: role,
          status: status || "active",
          email: email, // ensure email is synced
          grade_level: gradeLevel,
          child_age: childAge ? String(childAge) : null,
        })
        .eq("auth_id", authId);

      if (updateError) throw updateError;
    } else {
      // Insert new
      const { error: insertError } = await supabaseAdmin.from("users").insert({
        auth_id: authId,
        first_name: firstName,
        last_name: lastName,
        role: role,
        status: status || "active",
        email: email,
        grade_level: gradeLevel,
        child_age: childAge ? String(childAge) : null,
      });

      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true, user: authData.user });
  } catch (error: any) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, auth_id, email, password, firstName, lastName, role, status, gradeLevel, childAge } =
      body;

    if (!auth_id) {
      return NextResponse.json(
        { error: "User Auth ID is required" },
        { status: 400 }
      );
    }

    // 1. Update Auth User (Email/Password/Metadata)
    const authUpdates: any = {
      email,
      user_metadata: {
        role,
        first_name: firstName,
        last_name: lastName,
        grade_level: gradeLevel,
        child_age: childAge,
      },
    };
    if (password) {
      authUpdates.password = password;
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      auth_id,
      authUpdates
    );

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // 2. Update Public User
    const { error: publicError } = await supabaseAdmin
      .from("users")
      .update({
        first_name: firstName,
        last_name: lastName,
        email: email,
        role: role,
        status: status,
        grade_level: gradeLevel,
        child_age: childAge ? String(childAge) : null,
      })
      .eq("auth_id", auth_id);

    if (publicError) {
      return NextResponse.json({ error: publicError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const auth_id = searchParams.get("auth_id");

    if (!auth_id) {
      console.error(`[DELETE USER] Missing auth_id`);
      return NextResponse.json(
        { error: "Auth ID is required" },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(auth_id)) {
      console.error(`[DELETE USER] Invalid UUID format: ${auth_id}`);
      return NextResponse.json(
        { error: "Invalid auth_id format" },
        { status: 400 }
      );
    }

    console.log(`[DELETE USER] Starting deletion for auth_id: ${auth_id}`);

    // Check if supabaseAdmin is properly initialized
    if (!process.env.SUPABASE_SERVICE_ROLE && !process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE) {
      console.error(`[DELETE USER] FATAL: No SUPABASE_SERVICE_ROLE environment variable found`);
      return NextResponse.json(
        { 
          error: "Configuration error: Service role not configured. Contact administrator.",
          debug: "SUPABASE_SERVICE_ROLE environment variable is missing"
        },
        { status: 500 }
      );
    }

    // First, check if user exists in public.users table
    const { data: userData, error: checkError } = await supabaseAdmin
      .from("users")
      .select("id, auth_id")
      .eq("auth_id", auth_id)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      console.error(`[DELETE USER] Check error for ${auth_id}:`, checkError);
      return NextResponse.json(
        { error: `Erreur lors de la vérification: ${checkError.message}` },
        { status: 500 }
      );
    }

    if (!userData) {
      console.warn(`[DELETE USER] User not found in public.users for auth_id: ${auth_id}`);
      // Continue anyway - try to delete from auth
    } else {
      console.log(`[DELETE USER] Found user ${userData.id} with auth_id ${auth_id}`);
      
      // Delete all related data before deleting the user
      console.log(`[DELETE USER] Deleting related data for user ${userData.id}`);
      
      // Delete from all tables that reference users.id
      const tablesToClean = [
        { table: "admin_notifications", columns: ["admin_id", "user_id"] },
        { table: "user_sessions", columns: ["user_id"] },
        { table: "user_ai_interactions", columns: ["user_id"] },
        { table: "user_badges", columns: ["user_id"] },
        { table: "user_cosmetics", columns: ["user_id"] },
        { table: "user_course_progress", columns: ["user_id"] },
        { table: "user_exercise_attempts", columns: ["user_id"] },
        { table: "user_quiz_attempts", columns: ["user_id"] },
        { table: "referral_uses", columns: ["used_by_user_id"] },
        { table: "referral_codes", columns: ["owner_user_id"] },
        { table: "forum_reports", columns: ["reporter_id", "reported_user_id"] },
        { table: "forum_comments", columns: ["author_id"] },
        { table: "forum_posts", columns: ["author_id"] },
        { table: "exercises", columns: ["created_by"] },
        { table: "exercise_folders", columns: ["created_by"] },
        { table: "courses", columns: ["created_by"] },
        { table: "course_folders", columns: ["created_by"] },
      ];

      for (const { table, columns } of tablesToClean) {
        for (const column of columns) {
          const { error: deleteError } = await supabaseAdmin
            .from(table)
            .delete()
            .eq(column, userData.id);
          
          if (deleteError) {
            console.warn(`[DELETE USER] Error deleting from ${table}.${column}:`, deleteError.message);
            // Continue with other tables
          } else {
            console.log(`[DELETE USER] Cleaned ${table}.${column}`);
          }
        }
      }

      // Handle self-referencing children (parent_id)
      const { error: updateChildrenError } = await supabaseAdmin
        .from("users")
        .update({ parent_id: null })
        .eq("parent_id", userData.id);
      
      if (updateChildrenError) {
        console.warn(`[DELETE USER] Error updating children:`, updateChildrenError.message);
      } else {
        console.log(`[DELETE USER] Cleaned parent-child relationships`);
      }
    }

    // Delete from Auth
    console.log(`[DELETE USER] Deleting from Supabase Auth`);
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(auth_id);

    if (authError) {
      console.error(`[DELETE USER] Auth deletion error for ${auth_id}:`, authError);
      return NextResponse.json(
        { 
          error: `Erreur lors de la suppression de l'authentification: ${authError.message || authError}`,
          code: authError.code || "UNKNOWN_ERROR"
        },
        { status: 500 }
      );
    }

    console.log(`[DELETE USER] Auth user deleted successfully`);

    // Manually delete from public.users
    const { error: dbError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("auth_id", auth_id);
    
    if (dbError) {
      console.error(`[DELETE USER] DB deletion error for ${auth_id}:`, dbError);
      // Log but don't fail - auth user is already deleted
    }

    console.log(`[DELETE USER] Successfully completed deletion for auth_id: ${auth_id}`);
    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (error: any) {
    console.error(`[DELETE USER] Unexpected error:`, error);
    return NextResponse.json(
      { error: `Erreur serveur: ${error.message || String(error)}` },
      { status: 500 }
    );
  }
}
