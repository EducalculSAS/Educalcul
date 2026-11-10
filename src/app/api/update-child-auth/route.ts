import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { isValidEmail, validatePassword } from "@/lib/validation";
import { internalChildEmail, isInternalEmail } from "@/lib/childEmail";
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
      return NextResponse.json({ error: "Trop de tentatives, réessayez dans quelques minutes." }, { status: 429 });
    }

    const body = await request.json();
    const { childId, password } = body;
    // removeEmail : le parent retire l'adresse de l'enfant, le compte repasse sur son adresse technique (pseudo).
    const removeEmail = body.removeEmail === true;
    let newEmail: string | undefined = typeof body.newEmail === "string" && body.newEmail.trim() ? body.newEmail.trim() : undefined;

    if (!childId || (!password && !newEmail && !removeEmail)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    if (newEmail && (!isValidEmail(newEmail) || isInternalEmail(newEmail))) {
      return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
    }
    // Mêmes règles de mot de passe qu'à la création du profil.
    if (password) {
      const pwError = typeof password === "string" ? validatePassword(password) : "Mot de passe invalide";
      if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });
    }

    // 1. Verify the requester owns the child (admins may manage any child)
    let childQuery = supabaseAdmin
      .from("users")
      .select("id, auth_id, first_name, last_name, email, child_username, parent_id, role")
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

    if (removeEmail && !newEmail) {
      if (!childUser.child_username) return NextResponse.json({ error: "Un pseudo est nécessaire pour retirer l'e-mail." }, { status: 400 });
      newEmail = internalChildEmail(childUser.child_username);
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
      const email = newEmail || childUser.email || (childUser.child_username ? internalChildEmail(childUser.child_username) : "");
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

  } catch (error: unknown) {
    console.error("Error in update-child-auth:", error);
    return NextResponse.json(
      { error: sanitizeErrorMessage(errMessage(error) || "Internal server error") },
      { status: 500 }
    );
  }
}
