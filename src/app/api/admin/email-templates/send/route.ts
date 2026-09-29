import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { resolveParentRecipients, sendTemplate } from "@/lib/emailCampaign";
import { requireSuperAdmin } from "@/lib/apiAuth";

// Un envoi groupé peut durer : on laisse le maximum autorisé par le plan.
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireSuperAdmin(req);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { templateId, target, specificEmail, selectedUserId, customEmail } = await req.json();

    const { data: tmpl, error: tmplErr } = await supabaseAdmin
      .from("email_templates")
      .select("*")
      .eq("id", templateId)
      .single();
    if (tmplErr || !tmpl) return NextResponse.json({ error: "Template introuvable" }, { status: 404 });

    // Résoudre les destinataires
    let users: { email: string; first_name: string | null }[] = [];

    if (target === "custom_email" && customEmail) {
      // Adresse personnalisée — pas forcément un user du site
      users = [{ email: customEmail.trim(), first_name: null }];
    } else if (target === "specific_user" && selectedUserId) {
      const { data: u } = await supabaseAdmin
        .from("users").select("email, first_name").eq("id", selectedUserId).maybeSingle();
      if (!u) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
      users = [u];
    } else if (specificEmail) {
      const { data: u } = await supabaseAdmin
        .from("users").select("email, first_name").eq("email", specificEmail).maybeSingle();
      if (!u) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
      users = [u];
    } else {
      users = await resolveParentRecipients(target);
    }

    // Envoi + mise à jour de last_sent_at / sent_count
    const { sent, failed } = await sendTemplate(tmpl, users);

    return NextResponse.json({ success: true, sent, failed, total: users.length });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}

