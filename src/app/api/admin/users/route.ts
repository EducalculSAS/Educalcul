import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole, requireSuperAdmin } from "@/lib/apiAuth";
import { auditLog, AuditAction } from "@/lib/auditLog";
import {
  validateEmail,
  validateName,
  isValidRole,
  isValidUUID,
  validateString,
  validatePassword,
  validateUsername,
  isValidNumericId,
} from "@/lib/validation";
import { grantOfferedSubscription, isBillingMode } from "@/lib/adminGrantSubscription";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { SCHOOL_LEVELS } from "@/lib/constants";

const VALID_GRADE_LEVELS = new Set(SCHOOL_LEVELS.map((l) => l.value));

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

    // select(*) exclu volontairement : password_hash n'a rien à faire dans
    // une réponse JSON, même pour un admin.
    let query = supabaseAdmin
      .from("users")
      .select(
        "id, auth_id, email, child_username, first_name, last_name, role, parent_id, grade_level, avatar, status, created_at, updated_at, account_type, subscription_plan_id, subscription_expires_at, child_age, last_login_ip, last_login_city, last_login_country, last_active_at, latitude, longitude, avatar_border, name_animation, name_color, equipped_border, featured_badges, login_count, login_streak, last_login_date, ban_reason, ban_until, onboarding_completed, notif_weekly_reports, notif_offers_news, school_zone, two_factor_enabled, needs_grade_choice, graduated_at",
      )
      .order("created_at", { ascending: false });

    if (role && role !== "all" && isValidRole(role)) {
      query = query.eq("role", role);
    }
    if (
      status &&
      status !== "all" &&
      ["active", "inactive", "banned"].includes(status)
    ) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`[admin-users-get] Supabase error:`, error);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[admin-users-get] Catch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
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
    const rl = await rateLimitWithBackoff(`admin:user-create:${ip}`, 10, 60000); // 10 per minute
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const {
      email,
      password,
      firstName,
      lastName,
      role,
      status,
      gradeLevel,
      childAge,
      username,
      subscriptionPlanId,
      billingMode: rawBillingMode,
    } = body;

    // Par défaut "stripe" : aucun accès offert tant que l'admin ne le demande
    // pas explicitement (voir src/lib/adminGrantSubscription.ts).
    const billingMode = isBillingMode(rawBillingMode) ? rawBillingMode : "stripe";
    if (subscriptionPlanId !== undefined && subscriptionPlanId !== null && subscriptionPlanId !== "") {
      if (!isValidNumericId(String(subscriptionPlanId))) {
        return NextResponse.json({ error: "Invalid subscriptionPlanId" }, { status: 400 });
      }
    }

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
      return NextResponse.json(
        { error: "Invalid first name" },
        { status: 400 },
      );
    }

    const validatedLastName = validateName(lastName);
    if (!validatedLastName) {
      return NextResponse.json({ error: "Invalid last name" }, { status: 400 });
    }

    if (!isValidRole(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // ✓ La table "users" a une contrainte CHECK exigeant un child_username
    // non vide pour tout role="child" — sans ça, l'insertion échoue après
    // coup (une fois le compte auth déjà créé).
    let validatedUsername: string | null = null;
    if (role === "child") {
      validatedUsername = validateUsername(username);
      if (!validatedUsername) {
        return NextResponse.json(
          { error: "Nom d'utilisateur invalide (3-50 caractères, lettres/chiffres/_/-)" },
          { status: 400 },
        );
      }
      const { data: taken } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("child_username", validatedUsername)
        .maybeSingle();
      if (taken) {
        return NextResponse.json({ error: "Ce nom d'utilisateur est déjà pris." }, { status: 409 });
      }
      // Sans niveau scolaire, l'eleve ne voit aucun cours/exercice/quiz (le
      // catalogue est filtre par grade_level) — a ne jamais laisser vide.
      if (!VALID_GRADE_LEVELS.has(gradeLevel)) {
        return NextResponse.json({ error: "Niveau scolaire invalide" }, { status: 400 });
      }
    }

    // Create auth user
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
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
      const message =
        (authError as any)?.code === "email_exists"
          ? "Cet email est déjà utilisé par un compte existant."
          : "Failed to create user";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 },
      );
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
          child_username: validatedUsername,
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
        child_username: validatedUsername,
      });

      if (insertError) {
        // Le compte auth a été créé mais la ligne "users" a échoué : on
        // annule la création auth pour ne pas laisser un compte orphelin
        // qui bloquerait toute nouvelle tentative sur le même email
        // (AuthApiError "email_exists" sans qu'aucun profil n'existe).
        await supabaseAdmin.auth.admin.deleteUser(authId).catch((e) =>
          console.error("[admin-users-post] Rollback auth user failed:", e?.message),
        );
        throw insertError;
      }
    }

    // Abonnement attribué directement à la création, si l'admin en a choisi
    // un. "offert" = accès immédiat sans facturation ; "stripe" = on ne
    // donne rien ici, la personne paiera par le tunnel normal. Fonctionne
    // aussi pour un élève sans parent : getUserFeatures() lit l'abonnement du
    // compte lui-même dès qu'il n'a pas de parent_id.
    let grantedPlan: string | null = null;
    if (subscriptionPlanId && billingMode === "offert") {
      const granted = await grantOfferedSubscription({
        authId,
        planId: subscriptionPlanId,
      });
      if (!granted.ok) {
        return NextResponse.json(
          { error: `Compte créé, mais l'abonnement n'a pas pu être attribué : ${granted.error}` },
          { status: 400 },
        );
      }
      grantedPlan = granted.planName;
    }

    // ✓ SECURITY: Log admin action
    await auditLog(
      {
        action: AuditAction.USER_CREATED,
        adminId: admin.id,
        targetType: "user",
        targetId: authId,
        details: {
          email,
          role,
          firstName: validatedFirstName,
          lastName: validatedLastName,
          subscriptionPlanId: subscriptionPlanId || null,
          billingMode: subscriptionPlanId ? billingMode : null,
          grantedPlan,
        },
      },
      request,
    );

    return NextResponse.json({ success: true, user: authData.user, grantedPlan });
  } catch (error: any) {
    console.error("[admin-users-post] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    // ✓ SECURITY: peut changer email/mot de passe/role/statut de n'importe
    // quel utilisateur — reserve au super admin (un admin "support" ne doit
    // pas pouvoir se promouvoir ni modifier d'autres comptes).
    const admin = await requireSuperAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      auth_id,
      email,
      password,
      firstName,
      lastName,
      role,
      status,
      gradeLevel,
      childAge,
    } = body;

    // ✓ SECURITY: Validate input
    if (!isValidUUID(auth_id)) {
      return NextResponse.json({ error: "Invalid auth_id" }, { status: 400 });
    }

    if (email && !validateEmail(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    if (firstName && !validateName(firstName)) {
      return NextResponse.json(
        { error: "Invalid first name" },
        { status: 400 },
      );
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
      authUpdates,
    );

    if (authError) {
      console.error("[admin-users-put] Auth error:", authError);
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 400 },
      );
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
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 400 },
      );
    }

    // ✓ SECURITY: Log admin action
    await auditLog(
      {
        action: AuditAction.USER_UPDATED,
        adminId: admin.id,
        targetType: "user",
        targetId: auth_id,
        details: { email, role, firstName, lastName },
      },
      request,
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[admin-users-put] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    // ✓ SECURITY: suppression definitive d'un compte — reserve au super
    // admin, comme admin/users/[id] le fait deja pour la meme action.
    const admin = await requireSuperAdmin(request);
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
      return NextResponse.json(
        { error: "Failed to check user" },
        { status: 500 },
      );
    }

    if (!userData) {
      console.warn(
        `[DELETE USER] User not found in public.users for auth_id: ${auth_id}`,
      );
      // Continue anyway - try to delete from auth
    } else {
      console.log(
        `[DELETE USER] Found user ${userData.id} with auth_id ${auth_id}`,
      );

      // FIRST: Handle self-referencing children (parent_id) BEFORE deleting anything
      // This prevents CASCADE delete of children
      console.log(`[DELETE USER] Updating parent-child relationships`);
      const { error: updateChildrenError } = await supabaseAdmin
        .from("users")
        .update({ parent_id: null })
        .eq("parent_id", userData.id);

      if (updateChildrenError) {
        console.warn(
          `[DELETE USER] Error updating children:`,
          updateChildrenError.message,
        );
      } else {
        console.log(`[DELETE USER] Orphaned children (set parent_id to null)`);
      }

      // Delete all related data before deleting the user
      console.log(
        `[DELETE USER] Deleting related data for user ${userData.id}`,
      );

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
        {
          table: "forum_reports",
          columns: ["reporter_id", "reported_user_id"],
        },
        { table: "forum_comments", columns: ["author_id"] },
        { table: "forum_posts", columns: ["author_id"] },
        { table: "exercises", columns: ["created_by"] },
        { table: "exercise_folders", columns: ["created_by"] },
        { table: "courses", columns: ["created_by"] },
        { table: "course_folders", columns: ["created_by"] },
        // Tables ajoutées après un vrai blocage constaté : un admin de test
        // supprimé restait "fantôme" côté Supabase Auth car la suppression
        // de public.users échouait silencieusement sur une contrainte FK
        // (colonne NOT NULL, donc pas de ON DELETE SET NULL possible) —
        // voir aussi la migration qui bascule les colonnes nullable
        // équivalentes (audit_logs, feature_flags...) en ON DELETE SET NULL
        // plutôt que de perdre ces lignes.
        { table: "two_factor_totp", columns: ["user_id"] },
        { table: "two_factor_sessions", columns: ["user_id"] },
        { table: "two_factor_codes", columns: ["user_id"] },
        { table: "two_factor_backup_codes", columns: ["user_id"] },
        { table: "user_login_history", columns: ["user_id"] },
        { table: "calendar_events", columns: ["owner_id", "created_by"] },
        { table: "data_export_requests", columns: ["user_id"] },
        { table: "grade_promotion_snapshots", columns: ["user_id"] },
        { table: "scan_runs", columns: ["admin_id"] },
        { table: "content_generations", columns: ["admin_id"] },
      ];

      // Chaque (table, colonne) est une suppression indépendante des autres —
      // aucune ne dépend du résultat d'une autre, donc en parallèle.
      await Promise.all(
        tablesToClean.flatMap(({ table, columns }) =>
          columns.map(async (column) => {
            const { error: deleteError } = await supabaseAdmin
              .from(table)
              .delete()
              .eq(column, userData.id);
            if (deleteError) {
              console.warn(
                `[DELETE USER] Error deleting from ${table}.${column}:`,
                deleteError.message,
              );
            } else {
              console.log(`[DELETE USER] Cleaned ${table}.${column}`);
            }
          }),
        ),
      );
    }

    // Manually delete from public.users AVANT Supabase Auth : users.auth_id
    // référence auth.users.id sans cascade (ON DELETE NO ACTION), donc
    // supprimer auth.users en premier échoue systématiquement tant que
    // cette ligne existe encore — c'était la cause du "profil supprimé mais
    // le compte de connexion n'a pas pu l'être" observé sur TOUTES les
    // suppressions, retry et repli RPC compris (le repli fait le même DELETE
    // brut sur auth.users, bloqué par la même contrainte).
    const { error: dbError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("auth_id", auth_id);

    if (dbError) {
      console.error(
        `[DELETE USER] DB deletion error for ${auth_id}:`,
        JSON.stringify(dbError),
      );
    }

    // Delete from Auth. Retried once, puis en dernier recours via
    // admin_force_delete_auth_user (fonction SQL SECURITY DEFINER qui
    // supprime directement la ligne auth.users) — l'API Admin de Supabase
    // Auth échoue parfois avec une erreur générique "Database error deleting
    // user" sans cause identifiable côté schéma applicatif. Un compte
    // "fantôme" (profil supprimé, connexion Auth impossible à supprimer)
    // a déjà été observé en prod pour cette raison.
    console.log(`[DELETE USER] Deleting from Supabase Auth`);
    let { error: authError } =
      await supabaseAdmin.auth.admin.deleteUser(auth_id);
    if (authError) {
      console.warn(
        `[DELETE USER] Auth deletion failed, retrying once:`,
        JSON.stringify(authError),
      );
      ({ error: authError } =
        await supabaseAdmin.auth.admin.deleteUser(auth_id));
    }
    if (authError) {
      console.warn(
        `[DELETE USER] Auth API still failing for ${auth_id}, falling back to admin_force_delete_auth_user:`,
        JSON.stringify(authError),
      );
      const { error: rpcError } = await supabaseAdmin.rpc(
        "admin_force_delete_auth_user",
        { target_auth_id: auth_id },
      );
      if (rpcError) {
        console.error(
          `[DELETE USER] Fallback deletion also failed for ${auth_id} (${userData?.email}):`,
          JSON.stringify(rpcError),
        );
      } else {
        console.log(`[DELETE USER] Fallback deletion succeeded for ${auth_id}`);
        authError = null;
      }
    }

    // ✓ SECURITY: Log admin action
    await auditLog(
      {
        action: AuditAction.USER_DELETED,
        adminId: admin.id,
        targetType: "user",
        targetId: auth_id,
        details: { deletedEmail: userData?.email },
      },
      request,
    );

    console.log(
      `[DELETE USER] Successfully completed deletion for auth_id: ${auth_id}`,
    );
    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
      warning: dbError
        ? "Le compte de connexion a été supprimé mais le profil n'a pas pu l'être — contacte le support technique."
        : authError
          ? "Le profil a été supprimé mais le compte de connexion (Supabase Auth) n'a pas pu l'être — contacte le support technique."
          : undefined,
    });
  } catch (error: any) {
    console.error(`[DELETE USER] Unexpected error:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
