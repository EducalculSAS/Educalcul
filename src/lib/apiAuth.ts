import { supabaseAdmin } from "@/lib/supabaseClient";

export interface AuthenticatedUser {
  authId: string;
  id: number;
  role: string;
  parent_id: number | null;
}

/**
 * Verifies the Supabase JWT from the Authorization header and resolves the
 * matching row in public.users. Returns null when the token is missing,
 * invalid, or the user no longer exists.
 */
export async function getAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: row } = await supabaseAdmin
    .from("users")
    .select("id, role, parent_id")
    .eq("auth_id", data.user.id)
    .maybeSingle();
  if (!row) return null;

  return { authId: data.user.id, id: row.id, role: row.role, parent_id: row.parent_id };
}

/** Same as getAuthenticatedUser but only returns the user when their role matches. */
export async function requireRole(req: Request, roles: string[]): Promise<AuthenticatedUser | null> {
  const user = await getAuthenticatedUser(req);
  if (!user || !roles.includes(user.role)) return null;
  return user;
}
