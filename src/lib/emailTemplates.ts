// URL de base — utilisée pour les liens et le logo dans les emails envoyés
export const EMAIL_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://project-fz32e2.vercel.app";

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
  const BLUE = "#3a6ea5";
  const GOLD = "#c5a148";
  const CREAM = "#fdf6e3";
  const DARK = "#1a2c45";
  const LOGO = `${logoBaseUrl}/logo.png`;
  const BASE = EMAIL_BASE_URL;
  const YEAR = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${title}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}
    body{margin:0!important;padding:0!important;background-color:#f5f0e8;width:100%!important}
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
    @media only screen and (max-width:600px){
      .email-container{width:100%!important;margin:auto!important}
      .fluid{max-width:100%!important;height:auto!important}
      .stack-column,.stack-column-center{display:block!important;width:100%!important;max-width:100%!important}
      .body-pad{padding:28px 20px!important}
      .header-pad{padding:32px 20px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f5f0e8;font-family:'Inter',Arial,Helvetica,sans-serif;">
  ${preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}

  <center style="width:100%;background:#f5f0e8;text-align:left;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin:auto;" class="email-container">

      <!-- Espace haut -->
      <tr><td style="padding:24px 0 0;" aria-hidden="true">&nbsp;</td></tr>


      <!-- Carte principale -->
      <tr>
        <td style="padding:0 12px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-radius:16px;overflow:hidden;border:1px solid ${GOLD};box-shadow:0 8px 32px rgba(197,161,72,0.15),0 2px 8px rgba(0,0,0,0.08);">

            <!-- Header -->
            <tr>
              <td class="header-pad" style="background:${BLUE};padding:36px 40px;text-align:center;">
                <!-- Logo + nom dans le header -->
                <a href="${BASE}" style="text-decoration:none;display:inline-block;margin-bottom:18px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                    <tr>
                      <td style="padding-right:10px;vertical-align:middle;">
                        <img src="${LOGO}" alt="Educalcul" width="36" height="36" style="display:block;" />
                      </td>
                      <td style="vertical-align:middle;">
                        <span style="font-family:'Cinzel',Georgia,serif;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:1px;">Educalcul</span>
                      </td>
                    </tr>
                  </table>
                </a>
                <h1 style="margin:0 0 16px;font-family:'Cinzel',Georgia,serif;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:0.5px;line-height:1.35;">${title}</h1>
                <!-- Décoration : filet or -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="120">
                  <tr>
                    <td style="height:1px;background:rgba(197,161,72,0.6);font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr><td style="height:5px;font-size:0;">&nbsp;</td></tr>
                  <tr>
                    <td style="text-align:center;font-family:'Cinzel',Georgia,serif;font-size:13px;color:${GOLD};letter-spacing:3px;">✦ ✦ ✦</td>
                  </tr>
                  <tr><td style="height:5px;font-size:0;">&nbsp;</td></tr>
                  <tr>
                    <td style="height:1px;background:rgba(197,161,72,0.6);font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Corps -->
            <tr>
              <td class="body-pad" style="background:#ffffff;padding:36px 40px;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:15px;line-height:1.8;color:#374151;">
                ${body}
              </td>
            </tr>

            ${cta ? `
            <!-- CTA -->
            <tr>
              <td style="background:#ffffff;padding:0 40px 36px;text-align:center;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                  <tr>
                    <td style="border-radius:10px;background:${BLUE};border:2px solid ${GOLD};">
                      <a href="${cta.url}" style="display:inline-block;padding:14px 36px;font-family:'Cinzel',Georgia,serif;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:1px;text-transform:uppercase;border-radius:8px;">${cta.label}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:12px 0 0;font-size:11px;color:#9ca3af;font-family:'Inter',Arial,sans-serif;">
                  Si le bouton ne fonctionne pas : <a href="${cta.url}" style="color:${BLUE};word-break:break-all;">${cta.url}</a>
                </p>
              </td>
            </tr>` : ""}

            <!-- Séparateur gold -->
            <tr>
              <td style="height:3px;background:linear-gradient(90deg,${BLUE},${GOLD},${BLUE});"></td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:${CREAM};padding:24px 40px 28px;text-align:center;">
                <!-- Liens -->
                <p style="margin:0 0 10px;font-size:12px;font-family:'Inter',Arial,sans-serif;color:#7c6a3e;">
                  <a href="${BASE}" style="color:#5a4a2a;text-decoration:none;font-weight:500;">Accueil</a>&nbsp;&nbsp;·&nbsp;&nbsp;
                  <a href="${BASE}/parent/dashboard" style="color:#5a4a2a;text-decoration:none;font-weight:500;">Mon espace</a>&nbsp;&nbsp;·&nbsp;&nbsp;
                  <a href="${BASE}/faq" style="color:#5a4a2a;text-decoration:none;font-weight:500;">Aide</a>&nbsp;&nbsp;·&nbsp;&nbsp;
                  <a href="${BASE}/contact" style="color:#5a4a2a;text-decoration:none;font-weight:500;">Contact</a>&nbsp;&nbsp;·&nbsp;&nbsp;
                  <a href="${BASE}/cgu" style="color:#5a4a2a;text-decoration:none;font-weight:500;">CGU</a>&nbsp;&nbsp;·&nbsp;&nbsp;
                  <a href="${BASE}/politique-confidentialite" style="color:#5a4a2a;text-decoration:none;font-weight:500;">Confidentialité</a>
                </p>
                <!-- Désabo -->
                <p style="margin:0 0 14px;font-size:11px;color:#a89060;font-family:'Inter',Arial,sans-serif;">
                  <a href="${BASE}/parent/profile" style="color:#a89060;text-decoration:underline;">Gérer mes préférences email</a>
                </p>
                <!-- Séparateur -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="60" style="margin:0 auto 14px;"><tr><td style="height:1px;background:rgba(197,161,72,0.4);"></td></tr></table>
                <!-- Copyright -->
                <p style="margin:0;font-size:11px;color:#b89a60;font-family:'Cinzel',Georgia,serif;letter-spacing:0.5px;">
                  © ${YEAR} EDUCALCUL
                </p>
                <p style="margin:4px 0 0;font-size:10px;color:#c4a870;font-family:'Inter',Arial,sans-serif;">
                  Plateforme d'apprentissage des mathématiques
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>

      <!-- Espace bas -->
      <tr><td style="padding:20px 0;" aria-hidden="true">&nbsp;</td></tr>

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
        <p style="margin:0 0 16px;">Bonjour <strong>${firstName}</strong>,</p>
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

export function emailChangedEmail(firstName: string, newEmail: string) {
  return {
    subject: "Votre adresse email a été modifiée",
    textPart: `Bonjour ${firstName},\n\nVotre email Educalcul a changé. Nouvelle adresse : ${newEmail}\n\nSi vous n'êtes pas à l'origine de cette action, contactez-nous.\n\nL'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Adresse email modifiée",
      preheader: "Votre adresse email a été mise à jour",
      body: `
        <p style="margin:0 0 16px;">Bonjour <strong>${firstName}</strong>,</p>
        <p style="margin:0 0 20px;">Votre adresse email Educalcul a été modifiée avec succès.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 20px;">
          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;font-family:'Cinzel',Georgia,serif;">Nouvelle adresse</p>
              <p style="margin:0;font-size:16px;font-weight:600;color:#1a2c45;">${newEmail}</p>
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
        <p style="margin:0 0 16px;">Bonjour <strong>${firstName}</strong>,</p>
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
        <p style="margin:0 0 16px;">Bonjour <strong>${firstName}</strong>,</p>
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

export function welcomeEmail(firstName: string, confirmUrl: string) {
  return {
    subject: "Confirmez votre compte Educalcul",
    textPart: `Bonjour ${firstName},\n\nMerci de rejoindre Educalcul ! Confirmez votre email (lien valable 24h) :\n\n${confirmUrl}\n\nL'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Bienvenue sur Educalcul",
      preheader: "Confirmez votre compte pour commencer",
      body: `
        <p style="margin:0 0 16px;">Bonjour <strong>${firstName}</strong>,</p>
        <p style="margin:0 0 16px;">Votre inscription et votre paiement ont bien été enregistrés.</p>
        <p style="margin:0 0 24px;">Il ne reste qu'une étape — confirmez votre adresse email pour accéder à votre espace et commencer à suivre la progression de vos enfants.</p>
        <p style="margin:0;font-size:12px;color:#9ca3af;">Ce lien est valable <strong>24 heures</strong>.</p>
      `,
      cta: { label: "Confirmer mon adresse email", url: confirmUrl },
    }),
  };
}
