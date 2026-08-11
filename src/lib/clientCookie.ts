"use client";

/** Petits helpers cookie côté client pour des préférences non sensibles
 * (ex: dernier niveau scolaire consulté sur /programmes) — pas de
 * localStorage : un cookie léger, avec expiration, cohérent avec le reste
 * (voir CookieBanner.tsx pour le même principe côté consentement). */
export function getClientCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Sans `maxAgeDays`, pose un cookie de session (effacé à la fermeture du
 * navigateur) — équivalent cookie de sessionStorage. */
export function setClientCookie(name: string, value: string, maxAgeDays?: number) {
  const maxAge = maxAgeDays !== undefined ? `; max-age=${maxAgeDays * 86400}` : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/${maxAge}; SameSite=Lax`;
}

export function deleteClientCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}
