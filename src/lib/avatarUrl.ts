/**
 * Unique résolution d'avatar dans toute l'app.
 * - null / "" / "default.png" → fallback (initiales ou image par défaut)
 * - "/uploads/..." ou "http..." → chemin complet, utilisé tel quel
 * - "avatar6.png" etc. → "/avatars/avatar6.png"
 *
 * @param avatar  Valeur stockée en DB
 * @param fallback  Image de repli si pas d'avatar (défaut : null pour afficher initiales)
 */
export function avatarUrl(avatar: string | null | undefined, fallback?: string): string | null {
  if (!avatar || avatar === "default.png") return fallback ?? null;
  if (avatar.startsWith("/") || avatar.startsWith("http")) return avatar;
  return `/avatars/${avatar}`;
}
