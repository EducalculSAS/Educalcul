import { AVATARS } from "@/lib/constants";

/** Logo affiché comme avatar des comptes admin. */
export const ADMIN_AVATAR = "/logo.png";

/** "avatar3.png" ou "/avatars/avatar3.png" → "avatar3.png" ; sinon null. */
function presetName(value: string): string | null {
  const name = value.startsWith("/avatars/") ? value.slice("/avatars/".length) : value;
  return AVATARS.includes(name) ? name : null;
}

/**
 * Valeur d'avatar ACCEPTABLE en base, ou null si elle est refusée.
 *
 * Seuls les avatars proposés par le site sont admis (portraits préréglés, logo
 * pour les admins) : pas de photo envoyée, pas d'URL externe. Une image
 * externe aurait été montrée à tous les autres utilisateurs (forum,
 * classements), enfants compris. `""` efface l'avatar.
 */
export function sanitizeAvatar(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (v === "" || v === "default.png" || v === ADMIN_AVATAR) return v;
  return presetName(v);
}

/** Vignette d'un avatar préréglé : WebP carré de 256 px cadré sur le visage
 * (~4 Ko), au lieu du portrait PNG d'origine (~850 Ko) — c'est elle qui
 * s'affiche partout (forum, classements, listes). */
export function presetAvatarSrc(name: string): string {
  return `/avatars/thumb/${name.replace(/\.png$/i, ".webp")}`;
}

/**
 * Unique résolution d'avatar dans toute l'app.
 * - null / "" / "default.png" → fallback (initiales ou image par défaut)
 * - avatar préréglé ("avatar6.png", "/avatars/avatar6.png") → sa vignette
 * - logo admin → tel quel
 * - toute autre valeur (anciennes données : photo envoyée, URL externe) →
 *   fallback : jamais d'image hors des avatars du site
 *
 * @param avatar  Valeur stockée en DB
 * @param fallback  Image de repli si pas d'avatar (défaut : null pour afficher initiales)
 */
export function avatarUrl(avatar: string | null | undefined, fallback?: string): string | null {
  if (!avatar || avatar === "default.png") return fallback ?? null;
  if (avatar === ADMIN_AVATAR) return ADMIN_AVATAR;
  const preset = presetName(avatar);
  return preset ? presetAvatarSrc(preset) : fallback ?? null;
}
