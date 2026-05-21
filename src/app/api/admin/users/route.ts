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
      return NextResponse.json(
        { error: "Auth ID is required" },
        { status: 400 }
      );
    }

    console.log(`[DELETE USER] Starting deletion for auth_id: ${auth_id}`);

    // Delete from Auth (Cascade should handle public.users if set up, but let's be sure)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
      auth_id
    );

    if (authError) {
      console.error(`[DELETE USER] Auth deletion error for ${auth_id}:`, authError);
      return NextResponse.json(
        { error: `Erreur lors de la suppression de l'auth: ${authError.message}` },
        { status: 400 }
      );
    }

    console.log(`[DELETE USER] Auth user deleted, now deleting from users table`);

    // Manually delete from public.users just in case cascade isn't perfect or to be explicit
    const { error: dbError } = await supabaseAdmin.from("users").delete().eq("auth_id", auth_id);
    
    if (dbError) {
      console.error(`[DELETE USER] DB deletion error for ${auth_id}:`, dbError);
      return NextResponse.json(
        { error: `Erreur lors de la suppression de la BD: ${dbError.message}` },
        { status: 400 }
      );
    }

    console.log(`[DELETE USER] Successfully deleted user ${auth_id}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[DELETE USER] Unexpected error:`, error);
    return NextResponse.json(
      { error: `Erreur serveur: ${error.message}` },
      { status: 500 }
    );
  }
}
