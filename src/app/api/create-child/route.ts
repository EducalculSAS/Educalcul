import { sanitizeAvatar } from "@/lib/avatarUrl";
import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { validatePassword, isValidEmail } from "@/lib/validation";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { SCHOOL_LEVELS } from "@/lib/constants";
import { hasActiveSubscription } from "@/lib/subscriptionGate";
import { getChildLimit, childLimitMessage } from "@/lib/childLimit";

const GRADE_LEVELS = new Set(SCHOOL_LEVELS.map((l) => l.value));

export async function POST(request: Request) {
  try {
    const requester = await requireRole(request, ["parent", "admin"]);
    if (!requester) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Un parent sans abonnement actif ne peut pas créer d'enfant — même s'il
    // a contourné le verrou côté client (parent/layout.tsx) en appelant cette
    // route directement. Les admins ne sont pas concernés.
    if (requester.role === "parent" && !(await hasActiveSubscription(requester.authId))) {
      return NextResponse.json({ error: "Un abonnement actif est requis pour ajouter un enfant." }, { status: 403 });
    }

    // Nombre d'enfants inclus dans la formule (les admins ne sont pas concernés).
    if (requester.role === "parent") {
      const limit = await getChildLimit(requester);
      if (!limit.canAdd) return NextResponse.json({ error: childLimitMessage(limit), code: "child_limit" }, { status: 403 });
    }

    const config = RATE_LIMITS["child-account:mutate"];
    const rl = await rateLimitWithBackoff(`create-child:${requester.id}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de tentatives, réessaie dans quelques minutes." }, { status: 429 });
    }

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const username = typeof body.username === "string" && body.username.trim() ? body.username.trim() : null;
    const gradeLevel = typeof body.gradeLevel === "string" ? body.gradeLevel : "";
    const avatar = sanitizeAvatar(body.avatar) || "avatar1.png";

    if (!email || !password || !firstName) {
      return NextResponse.json({ error: "Prénom, email et mot de passe sont requis." }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
    }
    const pwError = validatePassword(password);
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });
    if (!GRADE_LEVELS.has(gradeLevel)) {
      return NextResponse.json({ error: "Niveau scolaire invalide" }, { status: 400 });
    }

    // Unicité du nom d'utilisateur — vérifiée côté serveur (avant, le client
    // faisait la requête lui-même, contournable).
    if (username) {
      const { data: taken } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("child_username", username)
        .maybeSingle();
      if (taken) {
        return NextResponse.json({ error: "Ce nom d'utilisateur est déjà pris." }, { status: 409 });
      }
    }

    // 1. Compte Supabase Auth — role toujours forcé à "child".
    const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "child", first_name: firstName, last_name: lastName },
    });
    if (authError || !created?.user) {
      console.error("[create-child] auth create failed:", authError);
      return NextResponse.json({ error: sanitizeErrorMessage(authError?.message || "Création impossible") }, { status: 400 });
    }

    // 2. Profil public.users — parent_id forcé au demandeur (jamais une valeur
    // fournie par le client). Avant, cet INSERT était fait depuis le navigateur.
    const { error: profileError } = await supabaseAdmin.from("users").insert({
      auth_id: created.user.id,
      parent_id: requester.id,
      first_name: firstName,
      last_name: lastName,
      email,
      child_username: username,
      grade_level: gradeLevel,
      avatar,
      role: "child",
      status: "active",
    });
    if (profileError) {
      // Rollback : pas de compte Auth orphelin si le profil échoue.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id).catch(() => {});
      console.error("[create-child] profile insert failed:", profileError);
      return NextResponse.json({ error: sanitizeErrorMessage(profileError.message) }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: { id: created.user.id } }, { status: 200 });
  } catch (error: unknown) {
    console.error("[create-child] server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
