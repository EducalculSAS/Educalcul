import { NextRequest, NextResponse } from "next/server";

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
async function getRole(authId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?auth_id=eq.${encodeURIComponent(authId)}&select=role`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.role || null;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

  if (isPublic(pathname, method)) return NextResponse.next();

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authId = await getAuthUserId(token);
  if (!authId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Published-content reads and avatar uploads: any authenticated user
  const isUserLevel =
    (method === "GET" && AUTHENTICATED_READ.has(pathname)) ||
    (method === "POST" && pathname === "/api/admin/upload");
  if (isUserLevel) return NextResponse.next();

  const role = await getRole(authId);
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/admin/:path*"],
};
