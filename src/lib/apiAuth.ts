import { supabaseAdmin } from "@/lib/supabaseClient";
import { hashTwoFactorValue } from "@/lib/twoFactor";
import { getTwoFactorCookieFromRequest } from "@/lib/twoFactorCookie";
import { verifySupabaseJwt } from "@/lib/supabaseJwt";
import { getClientIp as getClientIpOrNull } from "@/lib/ipGeo";

/** IP publique de l'appelant, telle que vue par Vercel (en-tête posé par la
 * plateforme, pas falsifiable depuis le client malgré le nom "forwarded"). */
export function getClientIp(req: Pick<Request, "headers">): string {
  return getClientIpOrNull(req) ?? "unknown";
}

/** True si `allowedIps` est vide/absent (pas de restriction) ou contient
 * l'IP de la requête — utilisé par getAuthenticatedUser et /api/auth/ip-check
 * pour les comptes (admin, en pratique) restreints à une liste d'IP. */
export function isIpAllowed(allowedIps: string[] | null | undefined, req: Request): boolean {
  if (!allowedIps || allowedIps.length === 0) return true;
  return allowedIps.includes(getClientIp(req));
}

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
  // Signature + expiration vérifiées en local via le JWKS Supabase (voir
  // supabaseJwt.ts) — plus d'appel réseau à GoTrue par requête.
  const identity = await verifySupabaseJwt(req);
  if (!identity) return null;

  const { data: row } = await supabaseAdmin
    .from("users")
    .select("id, role, parent_id, status, ban_reason, two_factor_enabled, has_passkey, admin_level, admin_allowed_ips")
    .eq("auth_id", identity.authId)
    .maybeSingle();

  if (!row) return null;

  // Un compte banni garde un JWT Supabase valide jusqu'à expiration : le
  // blocage ne peut pas reposer uniquement sur un redirect côté client
  // (contournable via un appel direct à l'API). On coupe l'accès ici, au
  // point d'entrée commun à toutes les routes authentifiées.
  if (row.status === "inactive" || row.ban_reason) return null;

  // Restriction d'IP optionnelle (admin_allowed_ips) : couche additionnelle
  // à la 2FA, pas un remplacement — un jeton/session déjà valides ne servent
  // plus à rien depuis une IP hors liste, même après une 2FA déjà validée
  // (pas seulement au login, voir aussi /api/auth/ip-check pour le login).
  if (!isIpAllowed(row.admin_allowed_ips, req)) return null;

  // 2FA optionnelle (opt-in) pour parent/enfant (email). Obligatoire dès la
  // création du compte pour les admins : tant que son TOTP n'est pas
  // configuré, un admin valide un code e-mail, puis /totp/setup et /confirm
  // (qui passent par CE gate) lui font configurer son application. Ainsi le
  // mot de passe seul ne permet jamais d'enrôler un TOTP à la place de l'admin.
  // Une clé d'accès enregistrée est un second facteur au même titre : sans
  // cette ligne, elle n'était vérifiée que dans le navigateur, et un appel
  // direct à l'API avec le seul mot de passe passait.
  const requires2FA = row.role === "admin" || row.two_factor_enabled || row.has_passkey;
  if (requires2FA) {
    const twoFAToken = getTwoFactorCookieFromRequest(req);
    if (!twoFAToken) return null;
    const { data: session } = await supabaseAdmin
      .from("two_factor_sessions")
      .select("expires_at")
      .eq("user_id", row.id)
      .eq("token_hash", hashTwoFactorValue(twoFAToken))
      .maybeSingle();
    if (!session || new Date(session.expires_at) < new Date()) return null;
  }

  return { authId: identity.authId, id: row.id, role: row.role, parent_id: row.parent_id, adminLevel: row.admin_level };
}

/**
 * Validates the Bearer token and returns the raw Supabase Auth identity,
 * WITHOUT requiring a public.users profile row to already exist. Use only for
 * the narrow case of a signed-in Supabase Auth user who has no profile yet
 * (e.g. Google sign-up before payment finalizes the account) — everywhere
 * else, prefer getAuthenticatedUser.
 */
export async function getAuthIdentityOnly(req: Request): Promise<{ authId: string; email: string | null } | null> {
  return verifySupabaseJwt(req);
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