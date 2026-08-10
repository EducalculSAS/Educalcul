import { supabaseAdmin } from "@/lib/supabaseClient";
import { createClient } from "@supabase/supabase-js";
import { hashTwoFactorValue } from "@/lib/twoFactor";

export interface AuthenticatedUser {
  authId: string;
  id: number;
  role: string;
  parent_id: number | null;
  /** Uniquement pour role="admin" : "super" (accès complet) ou "support"
   * (accès restreint — tickets, forum, profil). null pour les non-admins. */
  adminLevel: string | null;
}

export async function getAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  // Vérification expiration
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      console.log("[apiAuth] Token expiré");
      return null;
    }
  } catch {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log("[apiAuth] Variables d'environnement manquantes");
    return null;
  }

  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabaseUser.auth.getUser();
  if (error || !data?.user) return null;

  const { data: row } = await supabaseAdmin
    .from("users")
    .select("id, role, parent_id, status, ban_reason, two_factor_enabled, admin_level")
    .eq("auth_id", data.user.id)
    .maybeSingle();

  if (!row) return null;

  // Un compte banni garde un JWT Supabase valide jusqu'à expiration : le
  // blocage ne peut pas reposer uniquement sur un redirect côté client
  // (contournable via un appel direct à l'API). On coupe l'accès ici, au
  // point d'entrée commun à toutes les routes authentifiées.
  if (row.status === "inactive" || row.ban_reason) return null;

  // 2FA optionnelle (opt-in) pour parent/enfant (email). Obligatoire dès la
  // création du compte pour les admins (TOTP) — /totp/setup, /confirm et
  // /status utilisent getAuthIdentityOnly (pas ce gate), donc un admin peut
  // toujours configurer son TOTP même bloqué ici partout ailleurs : pas de
  // chicken-and-egg, et pas de fenêtre où un admin reste sans 2FA.
  const requires2FA = row.role === "admin" || row.two_factor_enabled;
  if (requires2FA) {
    const twoFAToken = req.headers.get("x-2fa-token");
    if (!twoFAToken) return null;
    const { data: session } = await supabaseAdmin
      .from("two_factor_sessions")
      .select("expires_at")
      .eq("user_id", row.id)
      .eq("token_hash", hashTwoFactorValue(twoFAToken))
      .maybeSingle();
    if (!session || new Date(session.expires_at) < new Date()) return null;
  }

  return { authId: data.user.id, id: row.id, role: row.role, parent_id: row.parent_id, adminLevel: row.admin_level };
}

/**
 * Validates the Bearer token and returns the raw Supabase Auth identity,
 * WITHOUT requiring a public.users profile row to already exist. Use only for
 * the narrow case of a signed-in Supabase Auth user who has no profile yet
 * (e.g. Google sign-up before payment finalizes the account) — everywhere
 * else, prefer getAuthenticatedUser.
 */
export async function getAuthIdentityOnly(req: Request): Promise<{ authId: string; email: string | null } | null> {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  } catch {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabaseUser.auth.getUser();
  if (error || !data?.user) return null;
  return { authId: data.user.id, email: data.user.email || null };
}

export async function requireRole(req: Request, roles: string[]): Promise<AuthenticatedUser | null> {
  const user = await getAuthenticatedUser(req);
  if (!user || !roles.includes(user.role)) return null;
  return user;
}

/** Pour les actions admin sensibles (bannir/supprimer un utilisateur, gérer
 * d'autres admins, sécurité, abonnements, emails) — un admin "support"
 * (accès restreint : tickets, forum, profil) n'y a pas accès, seul un admin
 * "super" (accès complet, comportement historique par défaut) peut agir. */
export async function requireSuperAdmin(req: Request): Promise<AuthenticatedUser | null> {
  const user = await getAuthenticatedUser(req);
  if (!user || user.role !== "admin" || user.adminLevel !== "super") return null;
  return user;
}

/**
 * True if `me` may read/act on the account identified by `targetAuthId` (a Supabase
 * auth UUID): the account itself, an admin, or the parent of that account.
 * Blocks horizontal privilege escalation (IDOR) when a route receives a target id
 * from the client.
 */
export async function canActOnAuthId(me: AuthenticatedUser, targetAuthId: string): Promise<boolean> {
  if (!targetAuthId) return false;
  if (me.authId === targetAuthId) return true;
  if (me.role === "admin") return true;
  if (me.role === "parent") {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", targetAuthId)
      .eq("parent_id", me.id)
      .maybeSingle();
    return !!data;
  }
  return false;
}

/** Same as canActOnAuthId but for an internal bigint users.id. */
export async function canActOnInternalId(me: AuthenticatedUser, targetInternalId: number): Promise<boolean> {
  if (!Number.isFinite(targetInternalId)) return false;
  if (me.id === targetInternalId) return true;
  if (me.role === "admin") return true;
  if (me.role === "parent") {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", targetInternalId)
      .eq("parent_id", me.id)
      .maybeSingle();
    return !!data;
  }
  return false;
}