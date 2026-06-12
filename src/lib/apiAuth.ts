import { supabaseAdmin } from "@/lib/supabaseClient";
import { createClient } from "@supabase/supabase-js";

export interface AuthenticatedUser {
  authId: string;
  id: number;
  role: string;
  parent_id: number | null;
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
    .select("id, role, parent_id")
    .eq("auth_id", data.user.id)
    .maybeSingle();

  if (!row) return null;

  return { authId: data.user.id, id: row.id, role: row.role, parent_id: row.parent_id };
}

export async function requireRole(req: Request, roles: string[]): Promise<AuthenticatedUser | null> {
  const user = await getAuthenticatedUser(req);
  if (!user || !roles.includes(user.role)) return null;
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