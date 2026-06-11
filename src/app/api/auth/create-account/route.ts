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
      sessionId,
      existingAuthId, // fourni pour les signups Google (user déjà créé via OAuth)
      cguAcceptedAt,
    } = await req.json();

    if (!role || !firstName || !email || !sessionId) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const rl = rateLimit(`create-account:${ip}`, 10, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de tentatives. Réessayez plus tard." }, { status: 429 });
    }

    const signUpEmail = email;

    let authUserId: string = existingAuthId || "";

    // Si pas d'auth existant -> créer l'utilisateur Supabase Auth (flow email/password)
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
          },
        });

      if (authError || !authData.user) {
        console.error("Auth creation error:", authError);
        return NextResponse.json(
          { error: authError?.message || "Impossible de créer l'utilisateur" },
          { status: 400 }
        );
      }

      authUserId = authData.user.id;
    }

    // Créer la ligne dans public.users
    // On vérifie d'abord si elle existe (cas Google où le trigger l'a peut-être déjà créée)
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
        cgu_accepted_at: cguAcceptedAt || new Date().toISOString(),
      });
      if (insertError) {
        console.error("User record insert error:", insertError.message, insertError.details);
        if (!insertError.message.includes("duplicate") && !insertError.message.includes("unique")) {
          return NextResponse.json({ error: `Impossible de créer le profil: ${insertError.message}` }, { status: 500 });
        }
      }
    } else {
      // Mettre à jour le profil si la ligne existe déjà (cas Google signup)
      await supabaseAdmin.from("users").update({
        first_name: firstName,
        last_name: lastName || "",
        role,
        status: "active",
      }).eq("auth_id", authUserId);
    }

    // Générer un lien de confirmation (email_confirm: false lors de la création)
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
    if (signUpEmail && signUpEmail.includes("@")) {
      const tmpl = welcomeEmail(firstName, confirmUrl);
      sendEmail({
        toEmail: signUpEmail,
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
