import { NextResponse } from "next/server";
import { randomUUID, createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { sendEmail } from "@/lib/mailer";
import { dataExportRequestEmail, EMAIL_BASE_URL } from "@/lib/emailTemplates";

// Droit à la portabilité (RGPD) : au lieu d'un téléchargement immédiat, un
// lien à usage personnel est envoyé par email (valable 24h) — voir
// /api/parent/export-data/download.
export async function POST(req: Request) {
  try {
    const me = await requireRole(req, ["parent"]);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("first_name, email")
      .eq("id", me.id)
      .maybeSingle();
    if (!user?.email) return NextResponse.json({ error: "Email introuvable" }, { status: 400 });

    const config = RATE_LIMITS["data-export:request"];
    const rl = await rateLimitWithBackoff(`data-export:${me.id}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de demandes, réessaie dans quelques minutes." }, { status: 429 });
    }

    const token = randomUUID();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin.from("data_export_requests").insert({
      user_id: me.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    const downloadUrl = `${EMAIL_BASE_URL}/api/parent/export-data/download?token=${token}`;
    const tmpl = dataExportRequestEmail(user.first_name || "là", downloadUrl);
    const result = await sendEmail({ toEmail: user.email, toName: user.first_name || "Utilisateur", ...tmpl });
    if (!result.success) {
      return NextResponse.json({ error: "Impossible d'envoyer l'email. Réessaie dans quelques instants." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
