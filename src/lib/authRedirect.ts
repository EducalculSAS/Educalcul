import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export type AuthUser = {
  role: string | null;
  status: string | null;
  ban_reason: string | null;
  first_name: string | null;
  two_factor_enabled: boolean | null;
};

/**
 * Récupère les infos du user connecté depuis public.users.
 * Retourne null si aucune ligne trouvée (compte pas encore créé).
 */
export async function getPublicUser(
  supabase: SupabaseClient,
  authId: string
): Promise<AuthUser | null> {
  const { data } = await supabase
    .from("users")
    .select("role, status, ban_reason, first_name, two_factor_enabled")
    .eq("auth_id", authId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Interroge /api/auth/2fa/totp/status (passe par le service role côté
 * serveur : two_factor_totp est verrouillée par RLS sans policy, illisible
 * directement depuis le client anon/authenticated).
 */
async function isAdminTotpConfirmedClient(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const res = await fetch("/api/auth/2fa/totp/status", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.confirmed;
  } catch {
    return false;
  }
}

/**
 * Le jeton de session 2FA vit dans un cookie httpOnly (voir
 * src/lib/twoFactorCookie.ts) : illisible depuis ce JS, donc on demande
 * directement au serveur s'il est encore valide (pas juste présent).
 */
async function hasValidTwoFactorSession(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const res = await fetch("/api/auth/2fa/totp/verify-session", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.valid;
  } catch {
    return false;
  }
}

/**
 * Retourne le chemin dashboard selon le rôle.
 */
export function getDashboardPath(role: string | null | undefined): string {
  if (role === "parent") return "/parent/dashboard";
  if (role === "child") return "/child/dashboard";
  if (role === "admin") return "/admin/dashboard";
  return "/dashboard";
}

/**
 * Méthode unique de redirection post-auth.
 * À utiliser dans : page connexion, callback, layouts.
 *
 * Retourne :
 *  - "banned"    → rediriger vers /auth/banned
 *  - "incomplete"→ compte créé par trigger sans first_name, doit compléter l'inscription
 *  - "no_account"→ aucun public.users trouvé
 *  - un path     → rediriger directement vers ce dashboard
 */
export async function resolveAuthDestination(
  supabase: SupabaseClient,
  authId: string
): Promise<string> {
  const user = await getPublicUser(supabase, authId);

  if (!user) return "no_account";
  if (user.status === "inactive" || user.ban_reason) return "banned";
  // Ligne créée par le trigger sans first_name = inscription non terminée
  if (!user.first_name) return "incomplete";

  const dashboard = getDashboardPath(user.role);

  // 2FA opt-in par email pour parent/enfant. Pour les admins, TOTP (Google
  // Authenticator) une fois sa configuration confirmée seulement — voir
  // src/lib/twoFactor.ts et /auth/2fa-verify (qui gère les deux méthodes).
  // Une session 2FA déjà valide sur cet appareil (cookie httpOnly) dispense
  // de repasser par la vérification.
  let requires2FA = !!user.two_factor_enabled;
  if (user.role === "admin") {
    requires2FA = await isAdminTotpConfirmedClient(supabase);
  }
  if (requires2FA) {
    const valid = await hasValidTwoFactorSession(supabase);
    if (!valid) return `/auth/2fa-verify?redirect=${encodeURIComponent(dashboard)}`;
  }

  return dashboard;
}

/**
 * Exécute la redirection directement via le router Next.js.
 * Retourne false si aucune session active.
 */
export async function redirectAfterAuth(
  supabase: SupabaseClient,
  router: AppRouterInstance
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const dest = await resolveAuthDestination(supabase, user.id);

  if (dest === "banned") {
    router.push("/auth/banned");
    return true;
  }
  if (dest === "no_account" || dest === "incomplete") {
    return false; // Laisser l'appelant gérer
  }

  router.push(dest);
  return true;
}
