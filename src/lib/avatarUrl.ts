import { AVATARS } from "@/lib/constants";

/**
 * Photo envoyée par un utilisateur : l'upload range tout fichier non-admin dans
 * `/avatars/` (voir /api/admin/upload), sous un nom `uuid_nom.ext`.
 */
const UPLOADED_AVATAR = /^\/(?:uploads\/)?avatars\/[A-Za-z0-9_.-]+\.(?:png|jpe?g|webp|gif)$/i;

/**
 * Valeur d'avatar ACCEPTABLE en base, ou null si elle est refusée.
 *
 * Seules des images servies par le site sont admises : un avatar préréglé, le
 * logo (comptes admin) ou une photo envoyée via l'upload. Une URL externe
 * aurait été affichée telle quelle à tous les autres utilisateurs (forum,
 * classements) : image arbitraire montrée à des enfants, et chaque affichage
 * aurait transmis l'adresse IP du visiteur au serveur de l'attaquant.
 * `""` est accepté : il efface l'avatar.
 */
export function sanitizeAvatar(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (v === "" || v === "default.png" || v === "/logo.png") return v;
  if (AVATARS.includes(v)) return v;
  if (UPLOADED_AVATAR.test(v) && !v.includes("..")) return v;
  return null;
}

/**
 * Unique résolution d'avatar dans toute l'app.
 * - null / "" / "default.png" → fallback (initiales ou image par défaut)
 * - chemin interne ("/avatars/…", "/logo.png") → utilisé tel quel
 * - "avatar6.png" etc. → "/avatars/avatar6.png"
 * - URL externe (ancienne donnée) → fallback : jamais d'image hors du site
 *
 * @param avatar  Valeur stockée en DB
 * @param fallback  Image de repli si pas d'avatar (défaut : null pour afficher initiales)
 */
export function avatarUrl(avatar: string | null | undefined, fallback?: string): string | null {
  if (!avatar || avatar === "default.png") return fallback ?? null;
  if (avatar.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(avatar)) return fallback ?? null;
  if (avatar.startsWith("/")) return avatar;
  return `/avatars/${avatar}`;
}
