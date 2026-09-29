import { escapeHtml } from "@/lib/validation";

// URL de base — utilisée pour les liens et le logo dans les emails envoyés
export const EMAIL_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://educalcul.com";

// Mêmes couleurs que le site (globals.css : --greek-*)
const NAVY = "#0f1e3a";
const NAVY_MID = "#1a3a6e";
const GOLD = "#c5a148";
const CREAM = "#faf7f2";
const BORDER = "#ede0c0";
const INK = "#1a1008";
const MUTED = "#6b5e42";
const SERIF = "'Cinzel',Georgia,serif";
const SANS = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";

/**
 * Gabarit commun de tous les emails, au style du site : héros bleu nuit avec
 * les symboles mathématiques dorés de la page d'accueil en filigrane (image
 * public/email/hero-symbols.png, mêmes positions que SYM dans app/page.tsx :
 * Gmail supprime position:absolute, une image de fond passe partout), titre Cinzel, carte blanche bordée
 * d'or sur fond crème, bouton pilule en verre bleu nuit.
 * Les clients mail n'appliquent pas tous le CSS : chaque effet a un repli
 * (couleur unie, bouton plein). Le reflet animé du bouton, le survol et
 * l'apparition de la carte ne jouent que dans les clients qui les gèrent
 * (Apple Mail, iOS), et jamais si l'utilisateur réduit les animations.
 */
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
  const LOGO = `${logoBaseUrl}/logo.png`;
  const BASE = EMAIL_BASE_URL;
  const YEAR = new Date().getFullYear();
  const link = `color:${MUTED};text-decoration:none;font-weight:500;`;

  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${title}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;display:block}
    body{margin:0!important;padding:0!important;width:100%!important}
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
    @media only screen and (max-width:620px){
      .email-container{width:100%!important;margin:auto!important}
      .hero-pad{padding:30px 24px 32px!important}
      .body-pad{padding:28px 24px 8px!important}
      .cta-pad{padding:8px 24px 30px!important}
      .hero-title{font-size:25px!important}
    }
  </style>
  <!-- Bloc séparé : si un client rejette ces règles, il ne perd pas les réglages mobiles ci-dessus -->
  <style>
    @media screen and (prefers-reduced-motion:no-preference){
      .site-card{animation:ec-rise .7s cubic-bezier(.2,.8,.2,1) both}
      .hero-bg{animation:ec-float 9s ease-in-out infinite}
      .glass-btn{
        background-image:linear-gradient(110deg,rgba(255,255,255,0) 38%,rgba(255,255,255,.3) 50%,rgba(255,255,255,0) 62%),linear-gradient(180deg,${NAVY_MID} 0%,${NAVY} 100%)!important;
        background-size:260% 100%,100% 100%!important;
        background-repeat:no-repeat!important;
        animation:ec-sheen 3.6s ease-in-out 1.2s infinite;
        transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s ease;
      }
      .glass-btn:hover{transform:translateY(-2px) scale(1.03);box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 14px 28px -10px rgba(15,30,58,.55),0 0 0 3px rgba(197,161,72,.35)!important}
      .glass-btn:active{transform:scale(.97)}
      .site-link{transition:color .2s ease}
      .site-link:hover{color:${NAVY}!important}
    }
    @keyframes ec-float{0%,100%{background-position:50% 50%}33%{background-position:50% 44%}66%{background-position:50% 54%}}
    @keyframes ec-rise{from{transform:translateY(14px)}to{transform:none}}
    @keyframes ec-sheen{0%{background-position:160% 0,0 0}55%,100%{background-position:-60% 0,0 0}}
  </style>
</head>
<body style="margin:0;padding:0;background-color:${CREAM};font-family:${SANS};">
  ${preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>` : ""}

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="${CREAM}" style="background-color:${CREAM};">
    <tr>
      <td align="center" style="padding:32px 12px 28px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin:auto;" class="email-container">
          <tr>
            <td>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="site-card" style="border-collapse:separate;border-radius:24px;box-shadow:0 18px 50px -22px rgba(15,30,58,.35);">

                <!-- Héros bleu nuit, comme en haut des pages du site -->
                <tr>
                  <td class="hero-pad hero-bg" bgcolor="${NAVY}" background="${logoBaseUrl}/email/hero-symbols.png" style="padding:34px 44px 42px;border-radius:24px 24px 0 0;background-color:${NAVY};background-image:url('${logoBaseUrl}/email/hero-symbols.png');background-size:cover;background-position:center;background-repeat:no-repeat;">
                    <a href="${BASE}" style="text-decoration:none;display:inline-block;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="padding-right:10px;vertical-align:middle;"><img src="${LOGO}" alt="" width="36" height="36" style="display:block;border-radius:8px;" /></td>
                          <td style="vertical-align:middle;"><span style="font-family:${SERIF};font-size:14px;font-weight:700;color:#ffffff;letter-spacing:2.5px;">EDUCALCUL</span></td>
                        </tr>
                      </table>
                    </a>
                    <p style="margin:34px 0 10px;font-family:${SANS};font-size:10.5px;font-weight:600;color:${GOLD};letter-spacing:2.5px;text-transform:uppercase;">Votre espace Educalcul</p>
                    <h1 class="hero-title" style="margin:0;font-family:${SERIF};font-size:31px;font-weight:700;color:#ffffff;letter-spacing:.3px;line-height:1.25;">${title}</h1>
                  </td>
                </tr>

                <!-- Filet or -->
                <tr><td style="height:3px;font-size:0;line-height:0;background:${GOLD};background-image:linear-gradient(90deg,${NAVY},${GOLD},${NAVY});">&nbsp;</td></tr>

                <!-- Corps -->
                <tr>
                  <td bgcolor="#ffffff" style="background:#ffffff;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};${cta ? "" : `border-bottom:1px solid ${BORDER};border-radius:0 0 24px 24px;`}">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td class="body-pad" style="padding:34px 44px ${cta ? 12 : 34}px;font-family:${SANS};font-size:15px;line-height:1.75;color:${INK};">
                          ${body}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${cta ? `
                <tr>
                  <td class="cta-pad" bgcolor="#ffffff" style="background:#ffffff;padding:14px 44px 38px;text-align:center;border:1px solid ${BORDER};border-top:none;border-radius:0 0 24px 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                      <tr>
                        <td style="border-radius:999px;background:${NAVY};">
                          <a href="${cta.url}" class="glass-btn" style="display:inline-block;padding:14px 32px;border-radius:999px;background-color:${NAVY};background-image:linear-gradient(180deg,${NAVY_MID} 0%,${NAVY} 100%);border:1px solid rgba(255,255,255,.18);box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 10px 22px -10px rgba(15,30,58,.5);font-family:${SERIF};font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:1px;">${cta.label}&nbsp;&nbsp;&rarr;</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:${MUTED};">
                      Le bouton ne fonctionne pas ?&nbsp;<a href="${cta.url}" style="color:${NAVY_MID};word-break:break-all;">${cta.url}</a>
                    </p>
                  </td>
                </tr>` : ""}
              </table>
            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td style="padding:26px 24px 8px;text-align:center;font-family:${SANS};">
              <p style="margin:0 0 12px;font-size:12px;line-height:2;color:${MUTED};">
                <a href="${BASE}/parent/dashboard" class="site-link" style="${link}">Mon espace</a>&nbsp;&middot;&nbsp;
                <a href="${BASE}/faq" class="site-link" style="${link}">Aide</a>&nbsp;&middot;&nbsp;
                <a href="${BASE}/contact" class="site-link" style="${link}">Contact</a>&nbsp;&middot;&nbsp;
                <a href="${BASE}/cgv" class="site-link" style="${link}">CGV</a>&nbsp;&middot;&nbsp;
                <a href="${BASE}/politique-confidentialite" class="site-link" style="${link}">Confidentialité</a>
              </p>
              <p style="margin:0 0 6px;font-size:11px;">
                <a href="${BASE}/parent/profile" class="site-link" style="color:#9a8a66;text-decoration:underline;">Gérer mes préférences email</a>
              </p>
              <p style="margin:0;font-size:10.5px;line-height:1.6;color:#a8997a;">
                © ${YEAR} <span style="font-family:${SERIF};letter-spacing:1px;">EDUCALCUL</span> SAS · 11 rue des Chênes, 78110 Le Vésinet<br />Plateforme d'apprentissage des mathématiques
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Alias pour compatibilité
export const emailTemplate = ({
  title, preheader, body, cta,
}: {
  title: string; preheader?: string; body: string; cta?: { label: string; url: string };
}) => buildEmailHtml({ title, preheader, body, cta });

// ── Blocs réutilisables dans le corps des emails ─────────────────────────────

type Tone = "info" | "warning" | "danger" | "success";
const TONES: Record<Tone, { bg: string; border: string; text: string }> = {
  info: { bg: "rgba(15,30,58,.04)", border: "rgba(15,30,58,.14)", text: NAVY },
  warning: { bg: "#fbf6e9", border: "rgba(197,161,72,.45)", text: "#7a5a12" },
  danger: { bg: "#fef2f2", border: "rgba(220,38,38,.28)", text: "#991b1b" },
  success: { bg: "#f0fdf4", border: "rgba(22,163,74,.3)", text: "#166534" },
};

/** Encadré teinté (alerte, info), bordé comme les cartes du site. `html` est inséré tel quel. */
export function emailCallout(html: string, tone: Tone = "warning"): string {
  const t = TONES[tone];
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;">
    <tr><td style="background:${t.bg};border:1px solid ${t.border};border-radius:14px;padding:14px 18px;">
      <p style="margin:0;font-size:13.5px;line-height:1.6;color:${t.text};">${html}</p>
    </td></tr>
  </table>`;
}

/** Valeur mise en avant (code, nouvelle adresse, méthode…). Texte échappé. */
export function emailHighlight(label: string, value: string, tone: Tone = "info", mono = false): string {
  const t = tone === "info" ? { bg: CREAM, border: BORDER, text: NAVY } : TONES[tone];
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 20px;">
    <tr><td align="center" style="background:${t.bg};border:1px solid ${t.border};border-radius:16px;padding:18px 20px;">
      <p style="margin:0 0 6px;font-size:10.5px;font-weight:600;color:${GOLD};text-transform:uppercase;letter-spacing:2px;">${escapeHtml(label)}</p>
      <p style="margin:0;font-size:${mono ? "32px" : "17px"};font-weight:700;color:${t.text};${mono ? "letter-spacing:8px;font-family:'SF Mono',Menlo,Consolas,monospace;" : ""}">${escapeHtml(value)}</p>
    </td></tr>
  </table>`;
}

/** Tableau récapitulatif (montant, formule, date…), en carte crème bordée d'or. Valeurs échappées. */
export function emailDetails(rows: [string, string][]): string {
  const trs = rows.map(([k, v], i) => `<tr>
      <td style="padding:12px 18px;font-size:13px;color:${MUTED};${i ? `border-top:1px solid ${BORDER};` : ""}">${escapeHtml(k)}</td>
      <td align="right" style="padding:12px 18px;font-size:14px;font-weight:700;color:${NAVY};${i ? `border-top:1px solid ${BORDER};` : ""}">${escapeHtml(v)}</td>
    </tr>`).join("");
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;background:${CREAM};border:1px solid ${BORDER};border-radius:16px;border-collapse:separate;">${trs}</table>`;
}

const hello = (firstName: string) => `<p style="margin:0 0 16px;">Bonjour <strong>${escapeHtml(firstName)}</strong>,</p>`;
const p = (html: string, last = false) => `<p style="margin:0 0 ${last ? 0 : 16}px;">${html}</p>`;
const small = (html: string) => `<p style="margin:0;font-size:12px;color:${MUTED};">${html}</p>`;
const notYou = (lead = "Ce n'est pas vous ?") =>
  emailCallout(`<strong>${lead}</strong> <a href="${EMAIL_BASE_URL}/contact" style="color:#7a5a12;font-weight:600;">Contactez-nous immédiatement</a> pour sécuriser votre compte.`);
const SUB_URL = `${EMAIL_BASE_URL}/parent/subscription`;

// ── Templates de sécurité ────────────────────────────────────────────────────

export function passwordChangedEmail(firstName: string) {
  const now = new Date();
  return {
    subject: "Votre mot de passe a été modifié",
    textPart: `Bonjour ${firstName},\n\nVotre mot de passe Educalcul vient d'être modifié.\n\nSi vous n'êtes pas à l'origine de cette action, contactez-nous sur ${EMAIL_BASE_URL}/contact\n\nL'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Mot de passe modifié",
      preheader: "Votre mot de passe a été mis à jour",
      body: `
        ${hello(firstName)}
        ${p("Votre mot de passe Educalcul vient d'être modifié avec succès.")}
        ${notYou()}
        ${small(`Action effectuée le ${now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} à ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`)}
      `,
      cta: { label: "Accéder à mon compte", url: `${EMAIL_BASE_URL}/auth/connexion` },
    }),
  };
}

export function twoFactorCodeEmail(firstName: string, code: string) {
  return {
    subject: `${code}, votre code de connexion Educalcul`,
    textPart: `Bonjour ${firstName},\n\nVotre code de vérification est : ${code}\n\nIl expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette tentative de connexion, ignorez cet email et changez votre mot de passe.\n\nL'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Code de vérification",
      preheader: `Votre code : ${code}`,
      body: `
        ${hello(firstName)}
        ${p("Voici votre code de vérification pour terminer la connexion à votre compte Educalcul :")}
        ${emailHighlight("Votre code", code, "info", true)}
        ${p(`<span style="font-size:13px;color:${MUTED};">Ce code expire dans 10 minutes.</span>`)}
        ${notYou("Vous n'êtes pas à l'origine de cette tentative ?")}
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
        ${hello(firstName)}
        ${p(`L'authentification à deux facteurs vient d'être <strong>${enabled ? "activée" : "désactivée"}</strong> sur votre compte Educalcul.`)}
        ${notYou()}
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
        ${hello(firstName)}
        ${p("Votre adresse email Educalcul a été modifiée avec succès.")}
        ${emailHighlight("Nouvelle adresse", newEmail)}
        ${notYou()}
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
        ${hello(firstName)}
        ${p("Une nouvelle méthode de connexion a été liée à votre compte.")}
        ${emailHighlight("Méthode ajoutée", method, "success")}
        ${notYou()}
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
        ${hello(firstName)}
        ${p(`<strong>${escapeHtml(method)}</strong> a été retiré de votre compte Educalcul.`)}
        ${notYou()}
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
        ${hello(firstName)}
        ${p("Comme demandé, voici le lien pour télécharger une copie de tes données (ton compte et ceux de tes enfants), au format JSON.")}
        ${small("Ce lien est valable <strong>24 heures</strong> et à usage personnel. Si tu n'es pas à l'origine de cette demande, ignore cet email.")}
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
        ${hello(firstName)}
        ${p(intro)}
        ${p("Il ne reste qu'une étape : confirmez votre adresse email pour accéder à votre espace et commencer à suivre la progression de vos enfants.")}
        ${small("Ce lien est valable <strong>24 heures</strong>.")}
      `,
      cta: { label: "Confirmer mon adresse email", url: confirmUrl },
    }),
  };
}

// ── Abonnement (envoyés par le webhook Stripe) ──────────────────────────────

/** Essai gratuit démarré : date de fin et premier prélèvement annoncés. */
export function trialStartedEmail(firstName: string, planName: string, trialEnd: string, price: string) {
  return {
    subject: "Votre essai Educalcul a commencé",
    textPart: `Bonjour ${firstName},\n\nVotre essai gratuit de la formule ${planName} est actif jusqu'au ${trialEnd}. Sans résiliation d'ici là, le premier prélèvement de ${price} aura lieu à cette date.\n\nGérer mon abonnement : ${SUB_URL}\n\nL'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Votre essai a commencé",
      preheader: `Essai gratuit jusqu'au ${trialEnd}`,
      body: `
        ${hello(firstName)}
        ${p("Bienvenue ! Votre essai gratuit est actif : toute la formule est ouverte, pour vous et vos enfants.")}
        ${emailDetails([["Formule", planName], ["Fin de l'essai", trialEnd], ["Premier prélèvement", price]])}
        ${p("Vous pouvez résilier à tout moment avant la fin de l'essai depuis votre espace Abonnement : aucun prélèvement n'aura alors lieu.", true)}
      `,
      cta: { label: "Gérer mon abonnement", url: SUB_URL },
    }),
  };
}

/** Rappel 3 jours avant la fin de l'essai gratuit (événement Stripe customer.subscription.trial_will_end). */
export function trialEndingEmail(firstName: string, planName: string, trialEnd: string, price: string) {
  return {
    subject: "Votre essai gratuit Educalcul se termine bientôt",
    textPart: `Bonjour ${firstName},

Votre essai gratuit de la formule ${planName} se termine le ${trialEnd}. Sans résiliation d'ici là, le premier prélèvement de ${price} aura lieu à cette date.

Vous pouvez résilier à tout moment depuis votre espace Abonnement : ${SUB_URL}

L'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Votre essai se termine bientôt",
      preheader: `Fin de l'essai le ${trialEnd}`,
      body: `
        ${hello(firstName)}
        ${p("Votre essai gratuit touche à sa fin. Nous espérons qu'il vous a plu !")}
        ${emailDetails([["Formule", planName], ["Fin de l'essai", trialEnd], ["Premier prélèvement", price]])}
        ${emailCallout("Vous ne souhaitez pas continuer ? Résiliez avant cette date, aucun prélèvement n'aura alors lieu.", "warning")}
      `,
      cta: { label: "Gérer mon abonnement", url: SUB_URL },
    }),
  };
}

export function paymentSucceededEmail(firstName: string, amount: string, planName: string, nextDate: string | null, invoiceUrl: string) {
  const rows: [string, string][] = [["Montant", amount], ["Formule", planName]];
  if (nextDate) rows.push(["Prochaine échéance", nextDate]);
  return {
    subject: "Votre paiement a été confirmé",
    textPart: `Bonjour ${firstName},\n\nVotre paiement de ${amount} a bien été enregistré. Votre accès est actif.${nextDate ? `\nProchaine échéance : ${nextDate}.` : ""}\n\nVotre facture : ${invoiceUrl}\n\nL'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Paiement confirmé",
      preheader: `${amount} encaissés, votre accès est actif`,
      body: `
        ${hello(firstName)}
        ${p("Merci ! Votre paiement a bien été enregistré et votre accès est actif.")}
        ${emailDetails(rows)}
      `,
      cta: { label: "Voir ma facture", url: invoiceUrl },
    }),
  };
}

export function paymentFailedEmail(firstName: string) {
  return {
    subject: "Problème avec votre paiement Educalcul",
    textPart: `Bonjour ${firstName},\n\nNous n'avons pas pu encaisser votre paiement. Mettez à jour votre moyen de paiement pour conserver votre accès : ${SUB_URL}\n\nL'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Problème de paiement",
      preheader: "Mettez à jour votre moyen de paiement",
      body: `
        ${hello(firstName)}
        ${p("Nous n'avons pas pu encaisser le paiement de votre abonnement Educalcul.")}
        ${emailCallout("Mettez à jour votre moyen de paiement pour conserver votre accès. Nous retenterons le prélèvement automatiquement.", "danger")}
      `,
      cta: { label: "Mettre à jour mon paiement", url: SUB_URL },
    }),
  };
}

/** Confirmation de résiliation, avec la date de fin (Code de la consommation, art. L.215-1-1). */
export function cancellationScheduledEmail(firstName: string, planName: string, endDate: string) {
  return {
    subject: "Confirmation de la résiliation de votre abonnement",
    textPart: `Bonjour ${firstName},\n\nNous confirmons la résiliation de votre abonnement ${planName}. Il prendra fin le ${endDate} : vous gardez l'accès jusqu'à cette date et aucun nouveau prélèvement n'aura lieu.\n\nVous avez changé d'avis ? Vous pouvez le réactiver avant cette date : ${SUB_URL}\n\nL'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Résiliation confirmée",
      preheader: `Votre abonnement prendra fin le ${endDate}`,
      body: `
        ${hello(firstName)}
        ${p("Nous confirmons la résiliation de votre abonnement. Aucun nouveau prélèvement n'aura lieu.")}
        ${emailDetails([["Formule", planName], ["Accès jusqu'au", endDate]])}
        ${p("Vous avez changé d'avis ? Vous pouvez réactiver votre abonnement avant cette date, sans rien perdre.", true)}
      `,
      cta: { label: "Réactiver mon abonnement", url: SUB_URL },
    }),
  };
}

export function cancellationRevokedEmail(firstName: string, planName: string, nextDate: string | null) {
  return {
    subject: "Votre abonnement Educalcul continue",
    textPart: `Bonjour ${firstName},\n\nLa résiliation de votre abonnement ${planName} a été annulée : il continue normalement${nextDate ? ` (prochaine échéance le ${nextDate})` : ""}.\n\nL'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Abonnement réactivé",
      preheader: "Votre abonnement continue normalement",
      body: `
        ${hello(firstName)}
        ${p("Bonne nouvelle : la résiliation a été annulée, votre abonnement continue normalement.")}
        ${emailDetails(nextDate ? [["Formule", planName], ["Prochaine échéance", nextDate]] : [["Formule", planName]])}
      `,
      cta: { label: "Mon abonnement", url: SUB_URL },
    }),
  };
}

export function subscriptionEndedEmail(firstName: string, planName: string) {
  return {
    subject: "Votre abonnement Educalcul est terminé",
    textPart: `Bonjour ${firstName},\n\nVotre abonnement ${planName} est terminé. Votre compte et la progression de vos enfants sont conservés : vous pouvez vous réabonner à tout moment sur ${SUB_URL}\n\nL'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Abonnement terminé",
      preheader: "Votre compte et vos données sont conservés",
      body: `
        ${hello(firstName)}
        ${p(`Votre abonnement <strong>${escapeHtml(planName)}</strong> est terminé. Merci d'avoir fait confiance à Educalcul.`)}
        ${emailCallout("Votre compte et la progression de vos enfants sont conservés : vous retrouverez tout en vous réabonnant.", "info")}
      `,
      cta: { label: "Voir les formules", url: SUB_URL },
    }),
  };
}

/** Accusé de réception de la rétractation, sur support durable (directive (UE) 2023/2673). */
export function withdrawalConfirmedEmail(firstName: string, planName: string, requestedAt: string, refund: string | null) {
  const rows: [string, string][] = [["Contrat", `Abonnement ${planName}`], ["Rétractation reçue le", requestedAt], ["Remboursement", refund ?? "Aucun montant prélevé"]];
  return {
    subject: "Accusé de réception de votre rétractation",
    textPart: `Bonjour ${firstName},

Nous avons bien reçu, le ${requestedAt}, votre rétractation du contrat d'abonnement ${planName}. L'abonnement est arrêté et aucun nouveau prélèvement n'aura lieu.${refund ? `
Remboursement : ${refund}, sur le moyen de paiement utilisé, sous 5 à 10 jours ouvrés.` : ""}

Votre compte et la progression de vos enfants sont conservés.

L'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Rétractation enregistrée",
      preheader: `Rétractation reçue le ${requestedAt}`,
      body: `
        ${hello(firstName)}
        ${p("Nous avons bien reçu votre rétractation. Votre abonnement est arrêté et aucun nouveau prélèvement n'aura lieu.")}
        ${emailDetails(rows)}
        ${refund ? emailCallout(`Le remboursement de <strong>${escapeHtml(refund)}</strong> (au prorata de la période non utilisée, comme prévu par nos CGV) est versé sur le moyen de paiement utilisé, sous 5 à 10 jours ouvrés.`, "success") : ""}
        ${p("Votre compte et la progression de vos enfants sont conservés : vous pouvez vous réabonner à tout moment.", true)}
      `,
      cta: { label: "Mon abonnement", url: SUB_URL },
    }),
  };
}

// ── Rapport hebdomadaire (tâche /api/cron/scheduled-emails) ─────────────────

export interface WeeklyChildStats {
  name: string;
  exercises: number;
  quizzes: number;
  /** Moyenne des scores (%) des exercices et quiz terminés, null si aucun. */
  averageScore: number | null;
  /** Temps passé sur les quiz, en minutes. */
  minutes: number;
  courses: number;
  badges: string[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function weeklyReportEmail(firstName: string, children: WeeklyChildStats[], period: string) {
  const blocks = children.map((c) => {
    const rows: [string, string][] = [];
    if (c.exercises) rows.push(["Exercices terminés", String(c.exercises)]);
    if (c.quizzes) rows.push(["Quiz terminés", String(c.quizzes)]);
    if (c.averageScore !== null) rows.push(["Score moyen", `${c.averageScore} %`]);
    if (c.minutes) rows.push(["Temps sur les quiz", `${c.minutes} min`]);
    if (c.courses) rows.push(["Cours terminés", String(c.courses)]);
    return `<p style="margin:22px 0 0;font-family:${SERIF};font-size:17px;font-weight:700;color:${NAVY};">${escapeHtml(c.name)}</p>
      ${rows.length ? emailDetails(rows) : ""}
      ${c.badges.length ? emailCallout(`<strong>${plural(c.badges.length, "badge gagné", "badges gagnés")} :</strong> ${c.badges.map(escapeHtml).join(", ")}`, "success") : ""}`;
  }).join("");
  const text = children.map((c) =>
    `${c.name} : ${plural(c.exercises, "exercice", "exercices")}, ${plural(c.quizzes, "quiz", "quiz")}${c.averageScore !== null ? `, score moyen ${c.averageScore} %` : ""}${c.courses ? `, ${plural(c.courses, "cours terminé", "cours terminés")}` : ""}${c.badges.length ? `, badges : ${c.badges.join(", ")}` : ""}.`).join("\n");
  return {
    subject: "Le rapport de la semaine sur vos enfants",
    textPart: `Bonjour ${firstName},

Voici les progrès ${period} :

${text}

Détail complet dans votre espace : ${EMAIL_BASE_URL}/parent/dashboard

Vous pouvez désactiver ce rapport dans Profil > Notifications.

L'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Le rapport de la semaine",
      preheader: `Les progrès de vos enfants ${period}`,
      body: `
        ${hello(firstName)}
        ${p(`Voici les progrès de vos enfants ${escapeHtml(period)}.`, true)}
        ${blocks}
        ${p("Bravo à eux : chaque petite séance compte !", true)}
      `,
      cta: { label: "Voir le détail dans mon espace", url: `${EMAIL_BASE_URL}/parent/dashboard` },
    }),
  };
}

// ── Rappels légaux (reconduction, inactivité) ───────────────────────────────

/** Rappel avant la reconduction tacite d'un abonnement annuel (Code de la consommation, art. L.215-1). */
export function renewalReminderEmail(firstName: string, planName: string, renewalDate: string) {
  return {
    subject: "Votre abonnement Educalcul sera renouvelé prochainement",
    textPart: `Bonjour ${firstName},

Votre abonnement ${planName} sera renouvelé automatiquement le ${renewalDate}, pour une nouvelle année.

Vous pouvez le résilier à tout moment avant cette date depuis votre espace Abonnement : ${SUB_URL}

L'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Renouvellement de votre abonnement",
      preheader: `Renouvellement automatique le ${renewalDate}`,
      body: `
        ${hello(firstName)}
        ${p(`Votre abonnement <strong>${escapeHtml(planName)}</strong> sera renouvelé automatiquement le <strong>${escapeHtml(renewalDate)}</strong>, pour une nouvelle année.`)}
        ${p("Si vous ne souhaitez pas le poursuivre, vous pouvez le résilier en quelques clics depuis votre espace Abonnement avant cette date : aucun prélèvement n'aura alors lieu.", true)}
      `,
      cta: { label: "Gérer mon abonnement", url: SUB_URL },
    }),
  };
}

/** Avertissement avant suppression d'un compte inactif depuis 3 ans (Politique de confidentialité). */
export function inactivityWarningEmail(firstName: string, deletionDate: string) {
  return {
    subject: "Votre compte Educalcul va être supprimé",
    textPart: `Bonjour ${firstName},

Votre compte Educalcul (et ceux de vos enfants) n'a pas été utilisé depuis plus de 3 ans. Conformément à notre politique de confidentialité, il sera supprimé le ${deletionDate}.

Pour le conserver, il suffit de vous connecter avant cette date : ${EMAIL_BASE_URL}/auth/connexion

L'équipe Educalcul`,
    htmlPart: buildEmailHtml({
      title: "Compte inactif",
      preheader: `Suppression prévue le ${deletionDate}`,
      body: `
        ${hello(firstName)}
        ${p("Votre compte Educalcul, ainsi que ceux de vos enfants, n'a pas été utilisé depuis plus de 3 ans.")}
        ${emailCallout(`Conformément à notre politique de confidentialité, il sera <strong>supprimé le ${escapeHtml(deletionDate)}</strong>, avec les données associées.`, "danger")}
        ${p("Pour le conserver, il suffit de vous connecter avant cette date.", true)}
      `,
      cta: { label: "Me connecter", url: `${EMAIL_BASE_URL}/auth/connexion` },
    }),
  };
}
