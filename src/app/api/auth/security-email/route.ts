import { NextRequest, NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
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
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { event, newEmail, method }: { event: EventType; newEmail?: string; method?: string } = await req.json();

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("first_name, email")
      .eq("id", me.id)
      .maybeSingle();

    const firstName = profile?.first_name || "Utilisateur";
    const toEmail = profile?.email || "";
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
        tmpl = signInMethodLinkedEmail(firstName, method || "Méthode inconnue");
        break;
      case "method_removed":
        tmpl = signInMethodRemovedEmail(firstName, method || "Méthode inconnue");
        break;
      default:
        return NextResponse.json({ error: "Événement inconnu" }, { status: 400 });
    }

    await sendEmail({ toEmail, toName: firstName, ...tmpl });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}

