import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { validatePassword, isValidEmail } from "@/lib/validation";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

export async function POST(request: Request) {
  try {
    const requester = await requireRole(request, ["parent", "admin"]);
    if (!requester) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = RATE_LIMITS["child-account:mutate"];
    const rl = await rateLimitWithBackoff(`create-child:${requester.id}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de tentatives, réessaie dans quelques minutes." }, { status: 429 });
    }

    const body = await request.json();
    const { email, password, user_metadata } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const pwError = validatePassword(password);
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }

    // Les comptes enfant utilisent désormais une vraie adresse email (pour
    // recevoir les codes 2FA et notifications), plus l'ancien domaine interne.
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
    }

    // Create user — role is always forced to "child", whatever the client sent.
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        ...user_metadata,
        role: "child",
      },
    });

    if (error) {
      console.error("Error creating user:", error);
      return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 400 });
    }

    return NextResponse.json({ user: data.user }, { status: 200 });
  } catch (error: any) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
