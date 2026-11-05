/** Faits d'identité d'Educalcul, repris par les données structurées, la page À propos et llms.txt : une seule source. */
export const SITE_URL = "https://educalcul.com";
export const ORG_ID = `${SITE_URL}/#organization`;
/** Organisation complète, à placer telle quelle dans les données structurées qui la citent (fournisseur d'un cours, auteur d'un article…). */
export const ORG_REF = { "@type": "Organization", "@id": ORG_ID, name: "Educalcul", url: SITE_URL } as const;

/** Éditeur, tel que publié dans les mentions légales (EDUCALCUL SAS, RCS Versailles). */
export const LEGAL_NAME = "EDUCALCUL";
export const LEGAL_STATUS = "société par actions simplifiée (SAS), RCS Versailles 108 436 445";
export const SIREN = "108436445";

export const CONTACT_EMAIL = "contact@educalcul.com";

export const FOUNDERS = [
  { name: "Ruben Combe-Tamain", jobTitle: "Co-fondateur, conception et développement de la plateforme" },
  { name: "Alexandre Tamain-Gloz", jobTitle: "Co-fondateur, contenus et pédagogie" },
] as const;

/** Date de la dernière vraie mise à jour des pages de contenu publiques (à changer quand on les modifie). */
export const SEO_UPDATED = "2026-11-04";

export const formatFrDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
