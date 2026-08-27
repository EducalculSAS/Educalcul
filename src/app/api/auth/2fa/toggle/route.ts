import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { sendEmail } from "@/lib/mailer";
import { twoFactorToggledEmail } from "@/lib/emailTemplates";

export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { enabled } = await req.json();
    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Paramètre invalide" }, { status: 400 });
    }

    if (me.role === "admin") {
      return NextResponse.json({ error: "Les comptes administrateur utilisent le TOTP (voir /api/auth/2fa/totp/*), pas ce commutateur." }, { status: 403 });
    }

    // Un enfant dont un parent a imposé la 2FA (two_factor_locked_by_parent)
    // ne peut pas la désactiver lui-même — vérifié ici, pas juste caché côté
    // UI, sinon un appel direct à cette route la contournerait.
    if (me.role === "child" && !enabled) {
      const { data: child } = await supabaseAdmin.from("users").select("two_factor_locked_by_parent").eq("id", me.id).maybeSingle();
      if (child?.two_factor_locked_by_parent) {
        return NextResponse.json({ error: "Un parent a activé la double authentification sur ce compte, tu ne peux pas la désactiver toi-même." }, { status: 403 });
      }
    }

    const { error } = await supabaseAdmin.from("users").update({ two_factor_enabled: enabled }).eq("id", me.id);
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    const { data: user } = await supabaseAdmin.from("users").select("first_name, email").eq("id", me.id).maybeSingle();
    if (user?.email) {
      const tmpl = twoFactorToggledEmail(user.first_name || "là", enabled);
      sendEmail({ toEmail: user.email, toName: user.first_name || "Utilisateur", ...tmpl })
        .then(undefined, (e) => console.error("[2fa/toggle] email non envoyé:", e?.message));
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
