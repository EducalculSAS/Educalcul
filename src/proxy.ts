import { NextRequest, NextResponse } from "next/server";

// Middleware tourne en runtime Edge : pas d'accès au module Node "crypto",
// on utilise donc SubtleCrypto (identique en résultat à
// src/lib/twoFactor.ts#hashTwoFactorValue qui utilise createHash côté Node).
async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ✓ SECURITY: Note - SERVICE_KEY is only used here for role checking
// Consider creating a restricted role in Supabase with only SELECT on users.role
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE!;

// GET endpoints under /api/admin that regular logged-in users can legitimately read
const AUTHENTICATED_READ = new Set([
  "/api/admin/courses",
  "/api/admin/exercises",
  "/api/admin/quizzes",
]);

// Endpoints reachable without any session (route validates its own output)
function isPublic(pathname: string, method: string) {
  // Plans list shown on public signup - route strips subscriber data for non-admin
  return pathname === "/api/admin/subscriptions" && method === "GET";
}

async function getAuthUserId(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.id || null;
  } catch {
    return null;
  }
}

// ✓ SECURITY IMPROVEMENT: Reduced scope - only fetch role, no other sensitive data
async function getRole(authId: string): Promise<{ role: string; id: number } | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?auth_id=eq.${encodeURIComponent(authId)}&select=id,role,status,ban_reason`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    const row = rows?.[0];
    if (!row) return null;
    // Même garde qu'apiAuth.ts : un JWT valide ne suffit pas si le compte a
    // été banni depuis son émission.
    if (row.status === "inactive" || row.ban_reason) return null;
    return row.role ? { role: row.role, id: row.id } : null;
  } catch {
    return null;
  }
}

async function has2FASession(userId: number, req: NextRequest): Promise<boolean> {
  const token = req.headers.get("x-2fa-token");
  if (!token) return false;
  try {
    const tokenHash = await sha256Hex(token);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/two_factor_sessions?user_id=eq.${userId}&token_hash=eq.${tokenHash}&select=expires_at`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    if (!res.ok) return false;
    const rows = await res.json();
    const row = rows?.[0];
    return !!row && new Date(row.expires_at) > new Date();
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

  if (isPublic(pathname, method)) return NextResponse.next();

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authId = await getAuthUserId(token);
  if (!authId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // getRole() renvoie null aussi bien pour "profil introuvable" que pour
  // "compte banni" : dans les deux cas l'accès doit être refusé, y compris
  // aux endpoints normalement ouverts à tout utilisateur authentifié.
  const user = await getRole(authId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Published-content reads and avatar uploads: any authenticated, non-banned user
  const isUserLevel =
    (method === "GET" && AUTHENTICATED_READ.has(pathname)) ||
    (method === "POST" && pathname === "/api/admin/upload");
  if (isUserLevel) return NextResponse.next();

  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 2FA (TOTP) obligatoire pour tout compte admin, dès sa création (les
  // routes /api/auth/2fa/totp/* ne sont pas sous /api/admin/*, donc un admin
  // pas encore configuré peut toujours configurer son TOTP malgré ce blocage).
  if (!(await has2FASession(user.id, req))) {
    return NextResponse.json({ error: "2FA required" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/admin/:path*"],
};

export default proxy;
