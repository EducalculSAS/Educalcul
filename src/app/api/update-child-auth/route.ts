import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { isValidEmail } from "@/lib/validation";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

export async function POST(request: Request) {
  try {
    // Identity comes from the verified JWT, never from the request body.
    const requester = await requireRole(request, ["parent", "admin"]);
    if (!requester) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = RATE_LIMITS["child-account:mutate"];
    const rl = await rateLimitWithBackoff(`update-child-auth:${requester.id}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de tentatives, réessaie dans quelques minutes." }, { status: 429 });
    }

    const body = await request.json();
    const { childId, password, newEmail } = body;

    if (!childId || (!password && !newEmail)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    if (newEmail && !isValidEmail(newEmail)) {
      return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
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
      if (newEmail) {
        updates.email = newEmail;
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
      const email = newEmail || childUser.email;
      if (!email || !isValidEmail(email)) {
        return NextResponse.json({ error: "Email de l'enfant manquant ou invalide" }, { status: 400 });
      }

      // Si un compte Auth existe déjà avec cet email, createUser échoue et
      // l'erreur est propagée ci-dessous (pas de pré-vérification nécessaire :
      // auth.users n'est pas interrogeable via l'API PostgREST).
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
      { error: sanitizeErrorMessage(error?.message || "Internal server error") },
      { status: 500 }
    );
  }
}
