// Garde-fou : ce module manipule une clé secrète. Importé par erreur depuis
// un composant client, la COMPILATION échoue au lieu d'exposer la clé dans
// le bundle du navigateur.
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

interface SendEmailParams {
  toEmail: string;
  toName: string;
  subject: string;
  textPart: string;
  htmlPart: string;
  fromEmail?: string;
  fromName?: string;
}

/**
 * Transporteur SMTP RÉUTILISÉ entre les envois (connexions en pool).
 *
 * Avant, chaque e-mail recréait un transporteur, donc une connexion TLS
 * complète vers Gmail : ~1 s de poignée de main par code 2FA ou par e-mail
 * d'un envoi groupé. Le pool garde quelques connexions ouvertes et les
 * réutilise tant que l'instance de fonction reste chaude.
 *
 * LIMITE CONNUE, non levable par le code : Gmail plafonne l'envoi à ~500
 * e-mails/jour (2 000 avec Workspace). Les codes 2FA passant par ce même
 * compte, un volume important d'utilisateurs exige un fournisseur d'e-mails
 * transactionnels.
 */
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) return null;
  transporter ??= nodemailer.createTransport({
    service: "gmail",
    pool: true,
    maxConnections: 3,
    auth: {
      user: gmailUser,
      pass: gmailPass, // mot de passe d'application (16 chars, pas le mot de passe Gmail normal)
    },
  });
  return transporter;
}

export async function sendEmail({ toEmail, toName, subject, textPart, htmlPart, fromEmail, fromName }: SendEmailParams) {
  const smtp = getTransporter();
  if (!smtp) {
    console.warn("Gmail credentials missing. Email not sent.");
    return { success: false, error: "Configuration Gmail manquante" };
  }

  try {
    await smtp.sendMail({
      from: `"${fromName || process.env.ADMIN_NAME_FROM || "Educalcul"}" <${fromEmail || "no-reply@educalcul.com"}>`,
      to: `"${toName}" <${toEmail}>`,
      subject,
      text: textPart,
      html: htmlPart,
    });
    return { success: true };
  } catch (err: any) {
    console.error("Gmail SMTP error:", err.message);
    return { success: false, error: err.message };
  }
}
