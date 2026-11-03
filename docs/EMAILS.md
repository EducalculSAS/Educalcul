# Comment Educalcul envoie ses e-mails

## En une phrase

Le site fabrique lui-même chaque e-mail (texte + HTML au style du site) et l'envoie par **SMTP Gmail**
avec `nodemailer`. Pour les liens de connexion / confirmation / réinitialisation, c'est **Supabase Auth**
qui fabrique le lien sécurisé, mais c'est **le site** qui l'envoie : Supabase n'envoie aucun e-mail lui-même.

## Les pièces

| Pièce | Fichier | Rôle |
|---|---|---|
| Envoi | `src/lib/mailer.ts` | `sendEmail()` : se connecte à Gmail (`GMAIL_USER` + `GMAIL_APP_PASSWORD`, un « mot de passe d'application »), réutilise les connexions (pool de 3). Expéditeur affiché : `no-reply@educalcul.com` (ou `support@educalcul.com` pour le support). |
| Gabarits | `src/lib/emailTemplates.ts` | `buildEmailHtml()` = habillage commun (bandeau bleu nuit, titre, bouton doré/bleu) + une fonction par e-mail (`welcomeEmail`, `twoFactorCodeEmail`…). Chaque gabarit renvoie `{ subject, textPart, htmlPart }`. |
| Adresse du site dans les liens | `EMAIL_BASE_URL` (variable `NEXT_PUBLIC_SITE_URL`, sinon `https://educalcul.com`) | Préfixe de tous les liens. |
| Envois groupés | `src/lib/emailCampaign.ts` | Envoie à tous les parents par lots de 5 en parallèle. |
| Modèles éditables | table `email_templates` (Admin > E-mails) | Textes modifiables sans toucher au code : formulaire de contact, réponse du support, e-mails planifiés. |

Limite : Gmail plafonne à environ 500 e-mails par jour. Au-delà, il faudra un service d'e-mails transactionnels.

## Les e-mails, un par un (déclencheur → lien)

### Compte et sécurité
| E-mail | Déclencheur | Lien dans le message |
|---|---|---|
| **Confirmation de compte** (« Confirmez votre compte Educalcul ») | Inscription (`/api/auth/create-account`), ou fin du paiement Stripe pour un compte payant | Lien magique créé par Supabase (`generateLink type=magiclink`) → il connecte la personne puis la renvoie sur `/auth/callback`. Valable 24 h. |
| **Mot de passe oublié** | Formulaire « Mot de passe oublié » (`/api/auth/forgot-password`) | Lien de récupération Supabase (`type=recovery`) → renvoie sur `/auth/update-password`. Valable 1 h, usage unique. Le site répond toujours « ok » (on ne révèle pas si le compte existe) et limite à quelques demandes par IP et par adresse. |
| **Code de double authentification** | Connexion avec la 2FA par e-mail (`/api/auth/2fa/send-code`) | Aucun lien : un code à 6 chiffres, valable 10 min, stocké haché dans `two_factor_codes`. |
| 2FA activée/désactivée | `/api/auth/2fa/toggle` | Aucun lien (information). |
| Mot de passe / e-mail changé, méthode de connexion ajoutée ou retirée | `/api/auth/security-email` (6 par heure max par compte) | Aucun lien (alerte de sécurité). |
| **Export des données** | Bouton dans le profil parent (`/api/parent/export-data`) | `/api/parent/export-data/download?token=…` : jeton à usage unique, valable 24 h, utilisable depuis n'importe quel appareil. Seul son hash est stocké. |

### Abonnement (envoyés par le webhook Stripe : `/api/webhooks/stripe`)
Essai démarré, essai bientôt fini, paiement réussi (avec lien vers la facture Stripe), paiement échoué, résiliation programmée / annulée, abonnement terminé, rétractation confirmée (`src/lib/withdrawal.ts`).
C'est **Stripe** qui prévient le site (événement signé), puis le site envoie l'e-mail.

### Automatiques (Vercel Cron, voir `vercel.json`)
| Tâche | Heure (UTC) | E-mail |
|---|---|---|
| `/api/cron/data-retention` | 02:30 | Rappel de renouvellement ; avertissement avant suppression d'un compte inactif (30 jours) |
| `/api/cron/scheduled-emails` | 07:00 | E-mails planifiés dans Admin > E-mails (chaque lundi ou le 1er du mois), dont le **bilan hebdomadaire** personnalisé par enfant |
| `/api/cron/family-alerts` | 17:00 | Alerte au parent quand un enfant est inactif |
Chaque tâche exige `Authorization: Bearer <CRON_SECRET>` (Vercel l'ajoute tout seul).

### Contact et support
- **Formulaire de contact** (`/api/contact`) : enregistre un ticket, envoie un accusé de réception à la personne et une notification à `ADMIN_EMAIL_FROM` (par défaut `support@educalcul.com`), à partir des modèles de la table `email_templates`.
- **Réponse du support** (Admin > Support) : e-mail envoyé depuis `support@educalcul.com` avec un bouton « Nous contacter » → `/contact`.
- **Envoi manuel** (Admin > E-mails) : à tous les parents, ou seulement à ceux qui ont coché « bilans hebdo » / « offres et actualités ».

## Le trajet d'un lien (exemple : mot de passe oublié)
1. La personne saisit son e-mail → le site appelle `POST /api/auth/forgot-password`.
2. Le serveur demande à Supabase un lien de récupération (clé de service) → Supabase renvoie une URL signée.
3. Le serveur met cette URL dans le bouton du gabarit et l'envoie via Gmail.
4. La personne clique : Supabase vérifie le lien, la connecte en mode « récupération » et la redirige vers `/auth/update-password`, où elle choisit un nouveau mot de passe.
5. Le site envoie ensuite l'alerte de sécurité « mot de passe modifié ».

## Variables nécessaires
`GMAIL_USER`, `GMAIL_APP_PASSWORD` (envoi) · `NEXT_PUBLIC_SITE_URL` (liens) · `ADMIN_EMAIL_FROM` / `ADMIN_NAME_FROM` (adresse de réception et nom d'expéditeur) · `CRON_SECRET` (tâches planifiées) · clés Supabase et Stripe.
Sans `GMAIL_USER`/`GMAIL_APP_PASSWORD`, aucun e-mail ne part (l'envoi renvoie une erreur « Configuration Gmail manquante »).
