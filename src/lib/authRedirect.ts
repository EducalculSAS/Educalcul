/**
 * Retourne le chemin dashboard selon le rôle. (Pur, utilisé côté client ET
 * dans /api/auth/resolve-destination.)
 */
export function getDashboardPath(role: string | null | undefined): string {
  if (role === "parent") return "/parent/dashboard";
  if (role === "child") return "/child/dashboard";
  if (role === "admin") return "/admin/dashboard";
  return "/dashboard";
}

/**
 * Destination post-authentification. TOUTE la logique (ban, rôle, inscription
 * incomplète, 2FA) est côté serveur : voir /api/auth/resolve-destination.
 * Le client ne lit plus `users` / `two_factor_*` directement.
 *
 * Retourne :
 *  - "banned"     → rediriger vers /auth/banned
 *  - "incomplete" → compte sans first_name, doit compléter l'inscription
 *  - "no_account" → aucun public.users trouvé
 *  - un path      → rediriger directement là
 */
export async function resolveAuthDestination(accessToken?: string): Promise<string> {
  try {
    const res = await fetch("/api/auth/resolve-destination", {
      // Juste après un login, le patch fetch global n'a pas toujours encore la
      // session : on passe le jeton explicitement quand l'appelant l'a.
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    if (!res.ok) return "no_account";
    const { dest } = await res.json();
    return typeof dest === "string" ? dest : "no_account";
  } catch {
    return "no_account";
  }
}
