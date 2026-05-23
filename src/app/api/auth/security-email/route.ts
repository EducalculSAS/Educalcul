import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendEmail } from "@/lib/mailer";
import {
  passwordChangedEmail,
  emailChangedEmail,
  signInMethodLinkedEmail,
  signInMethodRemovedEmail,
} from "@/lib/emailTemplates";

type EventType = "password_changed" | "email_changed" | "method_linked" | "method_removed";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non autorisÃ©" }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: "Session invalide" }, { status: 401 });

    const { event, newEmail, method }: { event: EventType; newEmail?: string; method?: string } = await req.json();

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("first_name, email")
      .eq("auth_id", user.id)
      .maybeSingle();

    const firstName = profile?.first_name || "Utilisateur";
    const toEmail = profile?.email || user.email || "";
    if (!toEmail) return NextResponse.json({ success: false });

    let tmpl: { subject: string; textPart: string; htmlPart: string };

    switch (event) {
      case "password_changed":
        tmpl = passwordChangedEmail(firstName);
        break;
      case "email_changed":
        tmpl = emailChangedEmail(firstName, newEmail || toEmail);
        break;
      case "method_linked":
        tmpl = signInMethodLinkedEmail(firstName, method || "MÃ©thode inconnue");
        break;
      case "method_removed":
        tmpl = signInMethodRemovedEmail(firstName, method || "MÃ©thode inconnue");
        break;
      default:
        return NextResponse.json({ error: "Ã‰vÃ©nement inconnu" }, { status: 400 });
    }

    await sendEmail({ toEmail, toName: firstName, ...tmpl });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

