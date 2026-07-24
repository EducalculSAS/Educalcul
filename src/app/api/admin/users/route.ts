import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { auditLog, AuditAction } from "@/lib/auditLog";
import { validateEmail, validateName, isValidRole, isValidUUID, validateString, validatePassword } from "@/lib/validation";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

export async function GET(request: Request) {
  try {
    // ✓ SECURITY: Require admin authentication
    const admin = await requireRole(request, ["admin"]);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const status = searchParams.get("status");

    let query = supabaseAdmin
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (role && role !== "all" && isValidRole(role)) {
      query = query.eq("role", role);
    }
    if (status && status !== "all" && ["active", "inactive", "banned"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`[admin-users-get] Supabase error:`, error);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[admin-users-get] Catch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // ✓ SECURITY: Require admin authentication
    const admin = await requireRole(request, ["admin"]);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✓ SECURITY: Rate limiting on user creation
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const rl = rateLimitWithBackoff(`admin:user-create:${ip}`, 10, 60000); // 10 per minute
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const { email, password, firstName, lastName, role, status, gradeLevel, childAge } = body;

    // ✓ SECURITY: Input validation
    if (!validateEmail(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const pwError = validatePassword(password);
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }

    const validatedFirstName = validateName(firstName);
    if (!validatedFirstName) {
      return NextResponse.json({ error: "Invalid first name" }, { status: 400 });
    }

    const validatedLastName = validateName(lastName);
    if (!validatedLastName) {
      return NextResponse.json({ error: "Invalid last name" }, { status: 400 });
    }

    if (!isValidRole(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role,
        first_name: validatedFirstName,
        last_name: validatedLastName,
        grade_level: gradeLevel,
        child_age: childAge,
      },
    });

    if (authError) {
      console.error("[admin-users-post] Auth error:", authError);
      return NextResponse.json({ error: "Failed to create user" }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    const authId = authData.user.id;

    // Check if user exists via trigger
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", authId)
      .maybeSingle();

    if (existingUser) {
      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          first_name: validatedFirstName,
          last_name: validatedLastName,
          role,
          status: status || "active",
          email,
          grade_level: gradeLevel,
          child_age: childAge ? String(childAge) : null,
        })
        .eq("auth_id", authId);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabaseAdmin.from("users").insert({
        auth_id: authId,
        first_name: validatedFirstName,
        last_name: validatedLastName,
        role,
        status: status || "active",
        email,
        grade_level: gradeLevel,
        child_age: childAge ? String(childAge) : null,
      });

      if (insertError) throw insertError;
    }

    // ✓ SECURITY: Log admin action
    await auditLog({
      action: AuditAction.USER_CREATED,
      adminId: admin.id,
      targetType: "user",
      targetId: authId,
      details: { email, role, firstName: validatedFirstName, lastName: validatedLastName },
    }, request);

    return NextResponse.json({ success: true, user: authData.user });
  } catch (error: any) {
    console.error("[admin-users-post] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    // ✓ SECURITY: Require admin authentication
    const admin = await requireRole(request, ["admin"]);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { auth_id, email, password, firstName, lastName, role, status, gradeLevel, childAge } = body;

    // ✓ SECURITY: Validate input
    if (!isValidUUID(auth_id)) {
      return NextResponse.json({ error: "Invalid auth_id" }, { status: 400 });
    }

    if (email && !validateEmail(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    if (firstName && !validateName(firstName)) {
      return NextResponse.json({ error: "Invalid first name" }, { status: 400 });
    }

    if (lastName && !validateName(lastName)) {
      return NextResponse.json({ error: "Invalid last name" }, { status: 400 });
    }

    if (role && !isValidRole(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Update auth user
    const authUpdates: any = {
      user_metadata: {
        role,
        first_name: firstName,
        last_name: lastName,
        grade_level: gradeLevel,
        child_age: childAge,
      },
    };
    if (email) authUpdates.email = email;
    if (password) {
      const pwError = validatePassword(password);
      if (pwError) {
        return NextResponse.json({ error: pwError }, { status: 400 });
      }
      authUpdates.password = password;
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      auth_id,
      authUpdates
    );

    if (authError) {
      console.error("[admin-users-put] Auth error:", authError);
      return NextResponse.json({ error: "Failed to update user" }, { status: 400 });
    }

    // Update public user
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
      console.error("[admin-users-put] Database error:", publicError);
      return NextResponse.json({ error: "Failed to update user" }, { status: 400 });
    }

    // ✓ SECURITY: Log admin action
    await auditLog({
      action: AuditAction.USER_UPDATED,
      adminId: admin.id,
      targetType: "user",
      targetId: auth_id,
      details: { email, role, firstName, lastName },
    }, request);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[admin-users-put] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    // ✓ SECURITY: Require admin authentication
    const admin = await requireRole(request, ["admin"]);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const auth_id = searchParams.get("auth_id");

    if (!auth_id || !isValidUUID(auth_id)) {
      return NextResponse.json({ error: "Invalid auth_id" }, { status: 400 });
    }

    console.log(`[DELETE USER] Starting deletion for auth_id: ${auth_id}`);

    // First, check if user exists in public.users table
    const { data: userData, error: checkError } = await supabaseAdmin
      .from("users")
      .select("id, auth_id, email")
      .eq("auth_id", auth_id)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      console.error(`[DELETE USER] Check error for ${auth_id}:`, checkError);
      return NextResponse.json({ error: "Failed to check user" }, { status: 500 });
    }

    if (!userData) {
      console.warn(`[DELETE USER] User not found in public.users for auth_id: ${auth_id}`);
      // Continue anyway - try to delete from auth
    } else {
      console.log(`[DELETE USER] Found user ${userData.id} with auth_id ${auth_id}`);
      
      // FIRST: Handle self-referencing children (parent_id) BEFORE deleting anything
      // This prevents CASCADE delete of children
      console.log(`[DELETE USER] Updating parent-child relationships`);
      const { error: updateChildrenError } = await supabaseAdmin
        .from("users")
        .update({ parent_id: null })
        .eq("parent_id", userData.id);
      
      if (updateChildrenError) {
        console.warn(`[DELETE USER] Error updating children:`, updateChildrenError.message);
      } else {
        console.log(`[DELETE USER] Orphaned children (set parent_id to null)`);
      }
      
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
    }

    // Delete from Auth. Retried once — a transient failure here previously left
    // "ghost" auth.users rows with no public.users profile behind (silently, since
    // this only logged a warning). Now surfaced to the caller if it still fails.
    console.log(`[DELETE USER] Deleting from Supabase Auth`);
    let { error: authError } = await supabaseAdmin.auth.admin.deleteUser(auth_id);
    if (authError) {
      console.warn(`[DELETE USER] Auth deletion failed, retrying once:`, authError.message);
      ({ error: authError } = await supabaseAdmin.auth.admin.deleteUser(auth_id));
    }
    if (authError) {
      console.error(`[DELETE USER] Auth deletion still failing for ${auth_id} (${userData?.email}):`, authError.message);
    }

    // Manually delete from public.users
    const { error: dbError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("auth_id", auth_id);

    if (dbError) {
      console.error(`[DELETE USER] DB deletion error for ${auth_id}:`, dbError);
      // Log but don't fail - auth user is already deleted
    }

    // ✓ SECURITY: Log admin action
    await auditLog({
      action: AuditAction.USER_DELETED,
      adminId: admin.id,
      targetType: "user",
      targetId: auth_id,
      details: { deletedEmail: userData?.email },
    }, request);

    console.log(`[DELETE USER] Successfully completed deletion for auth_id: ${auth_id}`);
    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
      warning: authError
        ? "Le profil a été supprimé mais le compte de connexion (Supabase Auth) n'a pas pu l'être — contacte le support technique."
        : undefined,
    });
  } catch (error: any) {
    console.error(`[DELETE USER] Unexpected error:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
