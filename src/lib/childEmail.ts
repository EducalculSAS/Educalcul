/**
 * Un enfant n'a pas forcément d'adresse e-mail : le parent peut en saisir une à la création du profil, mais c'est
 * facultatif. Supabase Auth exige pourtant une adresse par compte : sans e-mail réel, le compte est enregistré sous une
 * adresse technique dérivée du pseudo, jamais affichée et à laquelle on n'écrit jamais (voir mailer.ts).
 * L'enfant se connecte alors avec son pseudo (voir /api/auth/password-login).
 */
export const INTERNAL_EMAIL_DOMAIN = "educalcul.user";

export function internalChildEmail(username: string): string {
  return `${username.toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}`;
}

export function isInternalEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith(`@${INTERNAL_EMAIL_DOMAIN}`);
}

/** L'adresse réelle d'un compte, ou null s'il n'en a pas (adresse technique ou vide). */
export function realEmail(email: string | null | undefined): string | null {
  const e = (email || "").trim();
  return e && !isInternalEmail(e) ? e : null;
}
