import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { rateLimit } from "@/lib/rateLimit";
import { sendEmail } from "@/lib/mailer";
import { welcomeEmail } from "@/lib/emailTemplates";

export async function POST(req: NextRequest) {
  try {
    const {
      role,
      firstName,
      lastName,
      email,
      password,
      childUsername,
      childAge,   // legacy (parent-created children)
      childLevel, // self-registered lycéen
      parentEmail,
      sessionId,
      existingAuthId, // fourni pour les signups Google (user dÃ©jÃ  crÃ©Ã© via OAuth)
      cguAcceptedAt,
    } = await req.json();

    if (!role || !firstName || !email || !sessionId) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const rl = rateLimit(`create-account:${ip}`, 10, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de tentatives. RÃ©essayez plus tard." }, { status: 429 });
    }

    // Self-registered children provide their own real email
    const childHasOwnEmail = role === "child" && email && email.includes("@") && !email.endsWith("@educalcul.user");
    const signUpEmail = role === "child" && !childHasOwnEmail
      ? `${(childUsername || "").replace(/\s+/g, "").toLowerCase()}@educalcul.user`
      : email;

    let authUserId: string = existingAuthId || "";

    // Si pas d'auth existant â†’ crÃ©er l'utilisateur Supabase Auth (flow email/password)
    if (!authUserId) {
      const actualPassword =
        password ||
        Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);

      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: signUpEmail,
          password: actualPassword,
          email_confirm: true,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
            role,
            child_username: childUsername || null,
            child_age: childAge || null,
            child_level: childLevel || null,
            parent_email: parentEmail || null,
          },
        });

      if (authError || !authData.user) {
        console.error("Auth creation error:", authError);
        return NextResponse.json(
          { error: authError?.message || "Impossible de crÃ©er l'utilisateur" },
          { status: 400 }
        );
      }

      authUserId = authData.user.id;
    }

    // CrÃ©er la ligne dans public.users
    // On vÃ©rifie d'abord si elle existe (cas Google oÃ¹ le trigger l'a peut-Ãªtre dÃ©jÃ  crÃ©Ã©e)
    const { data: existingRow } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", authUserId)
      .maybeSingle();

    if (!existingRow) {
      const { error: insertError } = await supabaseAdmin.from("users").insert({
        auth_id: authUserId,
        first_name: firstName,
        last_name: lastName || "",
        email: signUpEmail,
        role,
        status: "active",
        child_username: childUsername || null,
        child_age: childAge || null,
        child_level: childLevel || null,
        parent_email: (role === "child" && parentEmail) ? parentEmail : null,
        cgu_accepted_at: cguAcceptedAt || new Date().toISOString(),
      });
      if (insertError) {
        console.error("User record insert error:", insertError.message, insertError.details);
        if (!insertError.message.includes("duplicate") && !insertError.message.includes("unique")) {
          return NextResponse.json({ error: `Impossible de crÃ©er le profil: ${insertError.message}` }, { status: 500 });
        }
      }
    } else {
      // Mettre Ã  jour le profil si la ligne existe dÃ©jÃ  (cas Google signup)
      await supabaseAdmin.from("users").update({
        first_name: firstName,
        last_name: lastName || "",
        role,
        status: "active",
      }).eq("auth_id", authUserId);
    }

    // GÃ©nÃ©rer un lien de confirmation (email_confirm: false lors de la crÃ©ation)
    let confirmUrl = "https://educalcul.com/parent/dashboard";
    try {
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: signUpEmail,
        options: { redirectTo: "https://educalcul.com/auth/callback" },
      });
      if (linkData?.properties?.action_link) {
        confirmUrl = linkData.properties.action_link;
      }
    } catch (e) {
      console.warn("Could not generate magic link, using dashboard URL");
    }

    // Email de confirmation avec lien (non bloquant)
    // Pour les enfants avec pseudo@educalcul.user, envoyer à parentEmail si disponible
    const welcomeRecipient = (role === "child" && !childHasOwnEmail && parentEmail)
      ? parentEmail
      : signUpEmail;
    if (welcomeRecipient && welcomeRecipient.includes("@") && !welcomeRecipient.endsWith("@educalcul.user")) {
      const tmpl = welcomeEmail(firstName, confirmUrl);
      sendEmail({
        toEmail: welcomeRecipient,
        toName: `${firstName} ${lastName || ""}`.trim(),
        ...tmpl,
      }).catch(console.error);
    }

    return NextResponse.json({ success: true, userId: authUserId, requireEmailConfirm: true });
  } catch (error: any) {
    console.error("Account creation error:", error);
    return NextResponse.json(
      { error: error?.message || "Erreur interne" },
      { status: 500 }
    );
  }
}

