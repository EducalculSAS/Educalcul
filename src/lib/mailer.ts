import nodemailer from "nodemailer";

interface SendEmailParams {
  toEmail: string;
  toName: string;
  subject: string;
  textPart: string;
  htmlPart: string;
}

export async function sendEmail({ toEmail, toName, subject, textPart, htmlPart }: SendEmailParams) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    console.warn("Gmail credentials missing. Email not sent.");
    return { success: false, error: "Configuration Gmail manquante" };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass, // mot de passe d'application (16 chars, pas le mot de passe Gmail normal)
      },
    });

    await transporter.sendMail({
      from: `"${process.env.ADMIN_NAME_FROM || "Educalcul"}" <${gmailUser}>`,
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
