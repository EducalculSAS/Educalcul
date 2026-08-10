import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { validateEmail, validateName, validateString } from "@/lib/validation";
import { sendEmail } from "@/lib/mailer";
import { welcomeEmail } from "@/lib/emailTemplates";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { getAuthenticatedUser } from "@/lib/apiAuth";

export async function POST(req: NextRequest) {
  try {
    const {
      role,
      firstName,
      lastName,
      email,
      password,
      sessionId,
      existingAuthId,
      cguAcceptedAt,
    } = await req.json();

    // ✓ HIGH PRIORITY FIX: Input validation
    if (!role || !firstName || !email || !sessionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ✓ SECURITY: this endpoint used to trust ANY sessionId at face value —
    // meaning a crafted request could create a full account without ever
    // paying. For real Stripe checkouts, account creation now happens
    // exclusively in the webhook (checkout.session.completed), which Stripe's
    // signature guarantees is genuine. This route only remains for the free
    // plan, which has no payment to fake in the first place.
    if (sessionId !== "free") {
      return NextResponse.json(
        { error: "Ce flux d'inscription n'est plus utilisé pour les abonnements payants." },
        { status: 400 }
      );
    }

    // ✓ HIGH PRIORITY FIX: Validate input lengths
    const validatedFirstName = validateName(firstName);
    const validatedLastName = validateName(lastName || "");
    if (!validatedFirstName) {
      return NextResponse.json({ error: "Invalid first name" }, { status: 400 });
    }
    if (lastName && !validatedLastName) {
      return NextResponse.json({ error: "Invalid last name" }, { status: 400 });
    }

    // ✓ HIGH PRIORITY FIX: Validate email format
    if (!validateEmail(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // ✓ SECURITY (élévation de privilèges + comptes orphelins) : l'inscription
    // publique ne crée que des comptes "parent". Un compte "child" doit
    // toujours être créé par un parent authentifié via /api/create-child
    // (qui exige un parent_id et un email interne @educalcul.user) — accepter
    // "child" ici permettrait de créer des comptes enfants sans parent,
    // rattachés à un vrai email, en contournant le modèle du produit.
    // Les comptes admin sont provisionnés hors de ce flux.
    if (role !== "parent") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // ✓ HIGH PRIORITY FIX: Advanced rate limiting with backoff
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const config = RATE_LIMITS["auth:signup"];
    const rl = await rateLimitWithBackoff(`auth:signup:${ip}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      const message = rl.blocked 
        ? "Too many signup attempts. Please try again in 1 hour." 
        : "Too many signup attempts. Please try again later.";
      return NextResponse.json({ error: message }, { status: 429 });
    }

    // ✓ SECURITY (IDOR) : existingAuthId vient du client — sans vérification,
    // n'importe qui pouvait fournir l'auth_id d'un AUTRE utilisateur et faire
    // écraser son profil (prénom/nom/rôle) par cette route non authentifiée.
    // On n'accepte existingAuthId que s'il correspond à la session réellement
    // authentifiée de l'appelant (token Bearer vérifié côté serveur).
    let authUserId: string = "";
    if (existingAuthId) {
      const me = await getAuthenticatedUser(req);
      if (!me || me.authId !== existingAuthId) {
        return NextResponse.json({ error: "Session invalide." }, { status: 401 });
      }
      authUserId = existingAuthId;
    }

    // Si pas d'auth existant -> créer l'utilisateur Supabase Auth (flow email/password)
    if (!authUserId) {
      // Mot de passe temporaire cryptographiquement sûr (l'utilisateur définira
      // le sien via le magic link). Math.random() n'est pas adapté aux secrets.
      const actualPassword =
        password || randomBytes(24).toString("base64url");

      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: actualPassword,
          email_confirm: true,
          user_metadata: {
            first_name: validatedFirstName,
            last_name: validatedLastName || "",
            role,
          },
        });

      if (authError || !authData.user) {
        console.error("Auth creation error:", authError);
        return NextResponse.json(
          { error: "Could not create account. Please try again." },
          { status: 400 }
        );
      }

      authUserId = authData.user.id;
    }

    // Créer la ligne dans public.users
    const { data: existingRow } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", authUserId)
      .maybeSingle();

    if (!existingRow) {
      const { error: insertError } = await supabaseAdmin.from("users").insert({
        auth_id: authUserId,
        first_name: validatedFirstName,
        last_name: validatedLastName || "",
        email,
        role,
        status: "active",
        cgu_accepted_at: cguAcceptedAt || new Date().toISOString(),
      });
      if (insertError) {
        console.error("User record insert error:", insertError);
        if (!insertError.message.includes("duplicate") && !insertError.message.includes("unique")) {
          return NextResponse.json({ error: "Could not create profile" }, { status: 500 });
        }
      }
    } else {
      // Mettre à jour le profil si la ligne existe déjà
      await supabaseAdmin.from("users").update({
        first_name: validatedFirstName,
        last_name: validatedLastName || "",
        role,
        status: "active",
      }).eq("auth_id", authUserId);
    }

    // Générer un lien de confirmation
    let confirmUrl = "https://educalcul.com/parent/dashboard";
    try {
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: email,
        options: { redirectTo: "https://educalcul.com/auth/callback" },
      });
      if (linkData?.properties?.action_link) {
        confirmUrl = linkData.properties.action_link;
      }
    } catch (e) {
      console.warn("Could not generate magic link");
    }

    // Email de confirmation (non bloquant)
    if (email && email.includes("@")) {
      const tmpl = welcomeEmail(validatedFirstName, confirmUrl);
      sendEmail({
        toEmail: email,
        toName: `${validatedFirstName} ${validatedLastName || ""}`.trim(),
        ...tmpl,
      }).catch(console.error);
    }

    return NextResponse.json({ success: true, userId: authUserId, requireEmailConfirm: true });
  } catch (error: any) {
    console.error("Account creation error:", error);
    return NextResponse.json(
      { error: sanitizeErrorMessage(error?.message || "Erreur interne") },
      { status: 500 }
    );
  }
}
