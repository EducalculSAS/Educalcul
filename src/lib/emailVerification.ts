import "server-only";
import { createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendEmail } from "@/lib/mailer";
import { welcomeEmail, EMAIL_BASE_URL } from "@/lib/emailTemplates";

/**
 * Vérification de l'adresse e-mail des comptes parents. Le compte Supabase Auth est créé « confirmé » (sinon les flux
 * d'inscription et de paiement ne pourraient pas ouvrir de session), mais l'espace parent reste fermé tant que
 * `users.email_verified_at` est vide : le parent doit cliquer sur le lien reçu par e-mail (src/app/parent/layout.tsx).
 * Le lien porte un jeton aléatoire à usage unique ; seule son empreinte est gardée en base. Un compte Google est
 * vérifié d'office (Google a déjà vérifié l'adresse), de même que tous les comptes créés avant cette vérification.
 */
const TTL_MS = 24 * 60 * 60 * 1000;

export const hashVerifyToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Le compte Auth a-t-il été créé par un fournisseur qui garantit l'adresse (Google) ? */
export async function isProviderVerified(authId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.auth.admin.getUserById(authId);
  const u = data?.user;
  if (!u) return false;
  const providers = [u.app_metadata?.provider, ...(Array.isArray(u.app_metadata?.providers) ? u.app_metadata.providers : [])];
  return providers.includes("google");
}

export async function markEmailVerified(userId: number): Promise<void> {
  await supabaseAdmin
    .from("users")
    .update({ email_verified_at: new Date().toISOString(), email_verify_token_hash: null, email_verify_expires_at: null })
    .eq("id", userId);
}

/** Crée un nouveau lien (l'ancien ne marche plus) et envoie l'e-mail de bienvenue qui le contient. */
export async function sendVerificationEmail(opts: { userId: number; email: string; firstName: string; paid?: boolean }): Promise<boolean> {
  const token = randomBytes(32).toString("base64url");
  const { error } = await supabaseAdmin
    .from("users")
    .update({ email_verify_token_hash: hashVerifyToken(token), email_verify_expires_at: new Date(Date.now() + TTL_MS).toISOString() })
    .eq("id", opts.userId);
  if (error) {
    console.error("[emailVerification] jeton non enregistré :", error.message);
    return false;
  }
  const url = `${EMAIL_BASE_URL}/api/auth/verify-email?t=${encodeURIComponent(token)}`;
  const tmpl = welcomeEmail(opts.firstName, url, opts.paid ?? false);
  const res = await sendEmail({ toEmail: opts.email, toName: opts.firstName || "Parent", ...tmpl });
  return !!res.success;
}

/** Après la création du profil d'un parent : vérifié d'office (Google) ou e-mail de vérification envoyé. */
export async function startEmailVerification(opts: { authId: string; email: string; firstName: string; paid?: boolean }): Promise<void> {
  const { data: row } = await supabaseAdmin.from("users").select("id, email_verified_at").eq("auth_id", opts.authId).maybeSingle();
  if (!row || row.email_verified_at) return;
  if (await isProviderVerified(opts.authId)) {
    await markEmailVerified(row.id);
    return;
  }
  if (opts.email) await sendVerificationEmail({ userId: row.id, email: opts.email, firstName: opts.firstName, paid: opts.paid });
}
