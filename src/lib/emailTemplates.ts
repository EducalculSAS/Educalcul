import { escapeHtml } from "@/lib/validation";

// URL de base — utilisée pour les liens et le logo dans les emails envoyés
export const EMAIL_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://educalcul.com";

// Pour la preview dans l'admin (localhost), on passe l'origine du navigateur
export function buildEmailHtml({
  title,
  preheader = "",
  body,
  cta,
  logoBaseUrl = EMAIL_BASE_URL,
}: {
  title: string;
  preheader?: string;
  body: string;
  cta?: { label: string; url: string };
  logoBaseUrl?: string;
}): string {
  const NAVY  = "#1a3a5c";
  const GOLD  = "#c5a148";
  const CREAM = "#fdf8ef";
  const LOGO  = `${logoBaseUrl}/logo.png`;
  const BASE  = EMAIL_BASE_URL;
  const YEAR  = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${title}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;display:block}
    body{margin:0!important;padding:0!important;background-color:#f0ece2;width:100%!important}
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
    @media only screen and (max-width:620px){
      .email-container{width:100%!important;margin:auto!important}
      .body-pad{padding:28px 22px!important}
      .header-pad{padding:32px 22px!important}
      .footer-pad{padding:20px 22px 24px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0ece2;font-family:'Inter',Arial,Helvetica,sans-serif;">
  ${preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>` : ""}

  <center style="width:100%;background:#f0ece2;text-align:left;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin:auto;" class="email-container">

      <tr><td style="padding:32px 0 0;" aria-hidden="true">&nbsp;</td></tr>

      <!-- Top brand bar -->
      <tr>
        <td style="padding:0 16px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${NAVY};border-radius:12px 12px 0 0;border-bottom:3px solid ${GOLD};">
            <tr>
              <td style="padding:18px 36px;text-align:center;">
                <a href="${BASE}" style="text-decoration:none;display:inline-block;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                    <tr>
                      <td style="padding-right:10px;vertical-align:middle;">
                        <img src="${LOGO}" alt="" width="48" height="48" style="display:block;border-radius:6px;" />
                      </td>
                      <td style="vertical-align:middle;">
                        <span style="font-family:'Cinzel',Georgia,serif;font-size:16px;font-weight:700;color:#ffffff;letter-spacing:2px;text-transform:uppercase;">EDUCALCUL</span>
                      </td>
                    </tr>
                  </table>
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Hero header -->
      <tr>
        <td style="padding:0 16px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:linear-gradient(160deg,${NAVY} 0%,#0f2640 100%);">
            <tr>
              <td class="header-pad" style="padding:44px 40px 36px;text-align:center;">
                <!-- Ornement haut -->
                <p style="margin:0 0 20px;font-family:'Cinzel',Georgia,serif;font-size:12px;color:${GOLD};letter-spacing:6px;text-transform:uppercase;opacity:.8;">✦ &nbsp; ✦ &nbsp; ✦</p>
                <h1 style="margin:0 0 18px;font-family:'Cinzel',Georgia,serif;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:0.5px;line-height:1.3;">${title}</h1>
                <!-- Filet or -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="200" style="margin:0 auto;">
                  <tr>
                    <td style="height:1px;background:linear-gradient(90deg,transparent,${GOLD},transparent);font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Corps -->
      <tr>
        <td style="padding:0 16px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#ffffff;border-left:1px solid rgba(197,161,72,0.2);border-right:1px solid rgba(197,161,72,0.2);">
            <tr>
              <td class="body-pad" style="padding:40px 40px 32px;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:15px;line-height:1.85;color:#374151;">
                ${body}
              </td>
            </tr>

            ${cta ? `
            <!-- CTA -->
            <tr>
              <td style="padding:0 40px 40px;text-align:center;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                  <tr>
                    <td style="border-radius:10px;background:${NAVY};border:2px solid ${GOLD};box-shadow:0 4px 16px rgba(197,161,72,0.25);">
                      <a href="${cta.url}" style="display:inline-block;padding:15px 40px;font-family:'Cinzel',Georgia,serif;font-size:12px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:2px;text-transform:uppercase;border-radius:8px;">${cta.label}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:14px 0 0;font-size:11px;color:#9ca3af;font-family:'Inter',Arial,sans-serif;">
                  Si le bouton ne fonctionne pas :&nbsp;<a href="${cta.url}" style="color:#3a6ea5;word-break:break-all;">${cta.url}</a>
                </p>
              </td>
            </tr>` : ""}
          </table>
        </td>
      </tr>

      <!-- Bande or -->
      <tr>
        <td style="padding:0 16px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr><td style="height:3px;background:linear-gradient(90deg,${NAVY},${GOLD},${NAVY});"></td></tr>
          </table>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:0 16px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${CREAM};border-radius:0 0 12px 12px;border:1px solid rgba(197,161,72,0.2);border-top:none;">
            <tr>
              <td class="footer-pad" style="padding:24px 36px 28px;text-align:center;">
                <!-- Ornement -->
                <p style="margin:0 0 14px;font-family:'Cinzel',Georgia,serif;font-size:10px;color:${GOLD};letter-spacing:4px;opacity:.7;">· · ·</p>
                <!-- Liens -->
                <p style="margin:0 0 12px;font-size:11px;font-family:'Inter',Arial,sans-serif;color:#8a7550;">
                  <a href="${BASE}" style="color:#6b5a3e;text-decoration:none;font-weight:500;">Accueil</a>&thinsp;·&thinsp;
                  <a href="${BASE}/parent/dashboard" style="color:#6b5a3e;text-decoration:none;font-weight:500;">Mon espace</a>&thinsp;·&thinsp;
                  <a href="${BASE}/faq" style="color:#6b5a3e;text-decoration:none;font-weight:500;">Aide</a>&thinsp;·&thinsp;
                  <a href="${BASE}/contact" style="color:#6b5a3e;text-decoration:none;font-weight:500;">Contact</a>&thinsp;·&thinsp;
                  <a href="${BASE}/cgu" style="color:#6b5a3e;text-decoration:none;font-weight:500;">CGU</a>&thinsp;·&thinsp;
                  <a href="${BASE}/politique-confidentialite" style="color:#6b5a3e;text-decoration:none;font-weight:500;">Confidentialité</a>
                </p>
                <p style="margin:0 0 16px;font-size:11px;color:#b09a6e;font-family:'Inter',Arial,sans-serif;">
                  <a href="${BASE}/parent/profile" style="color:#b09a6e;text-decoration:underline;">Gérer mes préférences email</a>
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="80" style="margin:0 auto 14px;"><tr><td style="height:1px;background:rgba(197,161,72,0.35);"></td></tr></table>
                <p style="margin:0;font-size:12px;color:#a08040;font-family:'Cinzel',Georgia,serif;letter-spacing:1px;font-weight:600;">
                  © ${YEAR} &nbsp;EDUCALCUL
                </p>
                <p style="margin:5px 0 0;font-size:10px;color:#c4a870;font-family:'Inter',Arial,sans-serif;letter-spacing:0.3px;">
                  Plateforme d'apprentissage des mathématiques
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr><td style="padding:24px 0;" aria-hidden="true">&nbsp;</td></tr>

    </table>
  </center>
</body>
</html>`;
}

// Alias pour compatibilité
export const emailTemplate = ({
  title, preheader, body, cta,
}: {
  title: string; preheader?: string; body: string; cta?: { label: string; url: string };
}) => buildEmailHtml({ title, preheader, body, cta });

// ── Templates de sécurité ────────────────────────────────────────────────────

export function passwordChangedEmail(firstName: string) {
  return {
    subject: "Votre mot de passe a été modifié",
    textPart: `Bonjour ${firstName},\n\nVotre mot de passe Educalcul vient d'être modifié.\n\nSi vous n'êtes pas à l'origine de cette action, contactez-nous sur ${EMAIL_BASE_URL}/contact\n\nL'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Mot de passe modifié",
      preheader: "Votre mot de passe a été mis à jour",
      body: `
        <p style="margin:0 0 16px;">Bonjour <strong>${escapeHtml(firstName)}</strong>,</p>
        <p style="margin:0 0 16px;">Votre mot de passe Educalcul vient d'être modifié avec succès.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;">
          <tr>
            <td style="background:#fffbeb;border-left:3px solid #c5a148;padding:14px 18px;border-radius:0 8px 8px 0;">
              <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;"><strong>Ce n'est pas vous ?</strong><br />
              Contactez-nous immédiatement depuis <a href="${EMAIL_BASE_URL}/contact" style="color:#92400e;font-weight:600;">la page Contact</a> pour sécuriser votre compte.</p>
            </td>
          </tr>
        </table>
        <p style="margin:0;font-size:12px;color:#9ca3af;">Action effectuée le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
      `,
      cta: { label: "Accéder à mon compte", url: `${EMAIL_BASE_URL}/auth/connexion` },
    }),
  };
}

export function twoFactorCodeEmail(firstName: string, code: string) {
  return {
    subject: `${code} — votre code de connexion Educalcul`,
    textPart: `Bonjour ${firstName},\n\nVotre code de vérification est : ${code}\n\nIl expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette tentative de connexion, ignorez cet email et changez votre mot de passe.\n\nL'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Code de vérification",
      preheader: `Votre code : ${code}`,
      body: `
        <p style="margin:0 0 16px;">Bonjour <strong>${escapeHtml(firstName)}</strong>,</p>
        <p style="margin:0 0 20px;">Voici votre code de vérification pour terminer la connexion à votre compte Educalcul :</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 20px;">
          <tr>
            <td align="center" style="background:#f8f6ef;border:1px solid rgba(197,161,72,0.3);border-radius:10px;padding:20px;">
              <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:8px;color:#1a3a5c;font-family:monospace;">${escapeHtml(code)}</p>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">Ce code expire dans 10 minutes.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="background:#fffbeb;border-left:3px solid #c5a148;padding:14px 18px;border-radius:0 8px 8px 0;">
              <p style="margin:0;font-size:13px;color:#92400e;">Vous n'êtes pas à l'origine de cette tentative ? <a href="${EMAIL_BASE_URL}/contact" style="color:#92400e;font-weight:600;">Contactez-nous</a> et changez votre mot de passe.</p>
            </td>
          </tr>
        </table>
      `,
    }),
  };
}

export function twoFactorToggledEmail(firstName: string, enabled: boolean) {
  return {
    subject: enabled ? "Authentification à deux facteurs activée" : "Authentification à deux facteurs désactivée",
    textPart: `Bonjour ${firstName},\n\nL'authentification à deux facteurs vient d'être ${enabled ? "activée" : "désactivée"} sur votre compte Educalcul.\n\nSi vous n'êtes pas à l'origine de cette action, contactez-nous sur ${EMAIL_BASE_URL}/contact\n\nL'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: enabled ? "2FA activée" : "2FA désactivée",
      preheader: `L'authentification à deux facteurs a été ${enabled ? "activée" : "désactivée"}`,
      body: `
        <p style="margin:0 0 16px;">Bonjour <strong>${escapeHtml(firstName)}</strong>,</p>
        <p style="margin:0 0 16px;">L'authentification à deux facteurs vient d'être <strong>${enabled ? "activée" : "désactivée"}</strong> sur votre compte Educalcul.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;">
          <tr>
            <td style="background:#fffbeb;border-left:3px solid #c5a148;padding:14px 18px;border-radius:0 8px 8px 0;">
              <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;"><strong>Ce n'est pas vous ?</strong><br />
              Contactez-nous immédiatement depuis <a href="${EMAIL_BASE_URL}/contact" style="color:#92400e;font-weight:600;">la page Contact</a> pour sécuriser votre compte.</p>
            </td>
          </tr>
        </table>
      `,
      cta: { label: "Accéder à mon compte", url: `${EMAIL_BASE_URL}/auth/connexion` },
    }),
  };
}

export function emailChangedEmail(firstName: string, newEmail: string) {
  return {
    subject: "Votre adresse email a été modifiée",
    textPart: `Bonjour ${firstName},\n\nVotre email Educalcul a changé. Nouvelle adresse : ${newEmail}\n\nSi vous n'êtes pas à l'origine de cette action, contactez-nous.\n\nL'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Adresse email modifiée",
      preheader: "Votre adresse email a été mise à jour",
      body: `
        <p style="margin:0 0 16px;">Bonjour <strong>${escapeHtml(firstName)}</strong>,</p>
        <p style="margin:0 0 20px;">Votre adresse email Educalcul a été modifiée avec succès.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 20px;">
          <tr>
            <td style="background:#f8f6ef;border:1px solid rgba(197,161,72,0.3);border-radius:10px;padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#8a7550;text-transform:uppercase;letter-spacing:0.8px;font-family:'Cinzel',Georgia,serif;">Nouvelle adresse</p>
              <p style="margin:0;font-size:16px;font-weight:600;color:#1a3a5c;">${newEmail}</p>
            </td>
          </tr>
        </table>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="background:#fffbeb;border-left:3px solid #c5a148;padding:14px 18px;border-radius:0 8px 8px 0;">
              <p style="margin:0;font-size:13px;color:#92400e;">Ce n'est pas vous ? <a href="${EMAIL_BASE_URL}/contact" style="color:#92400e;font-weight:600;">Contactez-nous immédiatement.</a></p>
            </td>
          </tr>
        </table>
      `,
    }),
  };
}

export function signInMethodLinkedEmail(firstName: string, method: string) {
  return {
    subject: `Nouvelle méthode de connexion ajoutée`,
    textPart: `Bonjour ${firstName},\n\n${method} a été ajouté à votre compte Educalcul.\n\nL'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Méthode de connexion ajoutée",
      preheader: `${method} lié à votre compte`,
      body: `
        <p style="margin:0 0 16px;">Bonjour <strong>${escapeHtml(firstName)}</strong>,</p>
        <p style="margin:0 0 20px;">Une nouvelle méthode de connexion a été liée à votre compte.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 20px;">
          <tr>
            <td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:0.8px;font-family:'Cinzel',Georgia,serif;">Méthode ajoutée</p>
              <p style="margin:0;font-size:16px;font-weight:600;color:#166534;">${method}</p>
            </td>
          </tr>
        </table>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="background:#fffbeb;border-left:3px solid #c5a148;padding:14px 18px;border-radius:0 8px 8px 0;">
              <p style="margin:0;font-size:13px;color:#92400e;">Ce n'est pas vous ? <a href="${EMAIL_BASE_URL}/contact" style="color:#92400e;font-weight:600;">Contactez-nous immédiatement.</a></p>
            </td>
          </tr>
        </table>
      `,
      cta: { label: "Gérer mon compte", url: `${EMAIL_BASE_URL}/parent/profile` },
    }),
  };
}

export function signInMethodRemovedEmail(firstName: string, method: string) {
  return {
    subject: `Méthode de connexion retirée`,
    textPart: `Bonjour ${firstName},\n\n${method} a été retiré de votre compte Educalcul.\n\nL'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Méthode de connexion retirée",
      preheader: `${method} retiré de votre compte`,
      body: `
        <p style="margin:0 0 16px;">Bonjour <strong>${escapeHtml(firstName)}</strong>,</p>
        <p style="margin:0 0 20px;"><strong>${method}</strong> a été retiré de votre compte Educalcul.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="background:#fffbeb;border-left:3px solid #c5a148;padding:14px 18px;border-radius:0 8px 8px 0;">
              <p style="margin:0;font-size:13px;color:#92400e;">Ce n'est pas vous ? <a href="${EMAIL_BASE_URL}/contact" style="color:#92400e;font-weight:600;">Contactez-nous immédiatement.</a></p>
            </td>
          </tr>
        </table>
      `,
      cta: { label: "Gérer mon compte", url: `${EMAIL_BASE_URL}/parent/profile` },
    }),
  };
}

export function dataExportRequestEmail(firstName: string, downloadUrl: string) {
  return {
    subject: "Tes données Educalcul sont prêtes",
    textPart: `Bonjour ${firstName},\n\nVoici le lien pour télécharger tes données (lien valable 24h) :\n\n${downloadUrl}\n\nSi tu n'es pas à l'origine de cette demande, ignore cet email.\n\nL'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Tes données Educalcul",
      preheader: "Lien de téléchargement de tes données",
      body: `
        <p style="margin:0 0 16px;">Bonjour <strong>${escapeHtml(firstName)}</strong>,</p>
        <p style="margin:0 0 16px;">Comme demandé, voici le lien pour télécharger une copie de tes données (ton compte et ceux de tes enfants), au format JSON.</p>
        <p style="margin:0;font-size:12px;color:#9ca3af;">Ce lien est valable <strong>24 heures</strong> et à usage personnel. Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>
      `,
      cta: { label: "Télécharger mes données", url: downloadUrl },
    }),
  };
}

export function welcomeEmail(firstName: string, confirmUrl: string, paid: boolean = true) {
  const intro = paid
    ? "Votre inscription et votre paiement ont bien été enregistrés."
    : "Votre inscription sur l'offre Gratuite a bien été enregistrée.";
  return {
    subject: "Confirmez votre compte Educalcul",
    textPart: `Bonjour ${firstName},\n\nMerci de rejoindre Educalcul ! Confirmez votre email (lien valable 24h) :\n\n${confirmUrl}\n\nL'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Bienvenue sur Educalcul",
      preheader: "Confirmez votre compte pour commencer",
      body: `
        <p style="margin:0 0 16px;">Bonjour <strong>${escapeHtml(firstName)}</strong>,</p>
        <p style="margin:0 0 16px;">${intro}</p>
        <p style="margin:0 0 24px;">Il ne reste qu'une étape — confirmez votre adresse email pour accéder à votre espace et commencer à suivre la progression de vos enfants.</p>
        <p style="margin:0;font-size:12px;color:#9ca3af;">Ce lien est valable <strong>24 heures</strong>.</p>
      `,
      cta: { label: "Confirmer mon adresse email", url: confirmUrl },
    }),
  };
}
