import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { validateEmail, validateName, validateString, isValidUUID } from "@/lib/validation";
import { auditLog, AuditAction } from "@/lib/auditLog";


export async function PUT(request: Request) {
  try {
    // ✓ SECURITY: Require admin authentication
    const admin = await requireRole(request, ["admin"]);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      auth_id,
      first_name,
      last_name,
      email,
      avatar,
      child_username,
      name_animation,
      avatar_border,
    } = body;

    // ✓ SECURITY: Validate auth_id
    if (!auth_id || !isValidUUID(auth_id)) {
      return NextResponse.json({ error: "Invalid auth_id" }, { status: 400 });
    }

    // ✓ SECURITY: Validate inputs
    if (first_name && !validateName(first_name)) {
      return NextResponse.json({ error: "Invalid first name" }, { status: 400 });
    }

    if (last_name && !validateName(last_name)) {
      return NextResponse.json({ error: "Invalid last name" }, { status: 400 });
    }

    if (email && !validateEmail(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    if (child_username && !validateString(child_username, 100)) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }

    // Map CSS class names → badge system keys
    const rawBorderKey = avatar_border ? avatar_border.replace(/^border-/, "") : "admin";
    const borderKey = (!rawBorderKey || rawBorderKey === "none") ? "admin" : rawBorderKey;
    const nameColorMap: Record<string, string> = {
      "text-admin":           "admin",
      "name-elite":           "elite",
      "name-flame":           "flame",
      "name-pro-animated":    "pro",
      "name-purple-animated": "premium",
      "name-teal-animated":   "famille",
      "name-diamond-animated":"diamond",
      "name-gold-animated":   "gold",
      "name-silver-animated": "silver",
      "name-bronze-animated": "bronze",
      "text-basic":           "default",
    };
    const rawColorKey = nameColorMap[name_animation] ?? "admin";
    const nameColorKey = (!rawColorKey || rawColorKey === "default") ? "admin" : rawColorKey;

    // Update public.users
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        first_name: first_name || undefined,
        last_name: last_name || undefined,
        email: email || undefined,
        child_username: child_username || undefined,
        avatar: avatar || undefined,
        name_animation: name_animation || undefined,
        avatar_border: avatar_border || undefined,
        equipped_border: borderKey,
        name_color: nameColorKey,
        updated_at: new Date().toISOString(),
      })
      .eq("auth_id", auth_id);

    if (updateError) {
      console.error("[admin-profile-put] Database error:", updateError);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    // Update Auth email if provided
    if (email) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(auth_id, {
        email: email,
        user_metadata: {
          first_name: first_name || undefined,
          last_name: last_name || undefined,
        }
      });
      
      if (authError) {
        console.error("[admin-profile-put] Auth error:", authError);
        // Don't fail entirely if auth update fails
      }
    }

    // ✓ SECURITY: Log admin action
    await auditLog({
      action: AuditAction.USER_UPDATED,
      adminId: admin.id,
      targetType: "user",
      targetId: auth_id,
      details: { email, firstName: first_name, lastName: last_name, username: child_username },
    }, request);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[admin-profile-put] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
