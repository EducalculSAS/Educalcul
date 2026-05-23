import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export type AuthUser = {
  role: string | null;
  status: string | null;
  ban_reason: string | null;
  first_name: string | null;
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
    .select("role, status, ban_reason, first_name")
    .eq("auth_id", authId)
    .maybeSingle();
  return data ?? null;
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

  return getDashboardPath(user.role);
}

/**
 * Exécute la redirection directement via le router Next.js.
 * Retourne false si aucune session active.
 */
export async function redirectAfterAuth(
  supabase: SupabaseClient,
  router: AppRouterInstance
): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return false;

  const dest = await resolveAuthDestination(supabase, session.user.id);

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
