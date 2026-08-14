import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { ipMatchesCidr } from "@/lib/adminIpAllowlist";
import { getClientIp } from "@/lib/ipGeo";

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
  if (pathname === "/api/admin/subscriptions" && method === "GET") return true;
  // Pendant une impersonation, la session active du navigateur est celle de
  // la CIBLE (parent/enfant), pas de l'admin — ces deux routes s'autorisent
  // elles-mêmes via le cookie httpOnly edu_impersonation, pas via ce garde
  // admin+2FA (voir src/lib/impersonationCookie.ts).
  if (pathname === "/api/admin/impersonate/status" && method === "GET") return true;
  if (pathname === "/api/admin/impersonate/end" && method === "POST") return true;
  return false;
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
  // Cookie httpOnly (voir src/lib/twoFactorCookie.ts) — nom en dur ici plutôt
  // qu'importé pour ne pas tirer next/headers dans ce fichier Edge Middleware.
  const token = req.cookies.get("edu_2fa")?.value;
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

// Liste blanche IP admin — désactivée tant que la table est vide (pas de
// risque de se bloquer soi-même). Requête REST directe comme le reste de ce
// fichier (runtime Edge, pas le client supabaseAdmin habituel).
async function isIpAllowed(req: NextRequest): Promise<boolean> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_ip_allowlist?select=cidr`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    if (!res.ok) return true; // panne de lecture → ne bloque pas tous les admins
    const rows: { cidr: string }[] = await res.json();
    if (!rows || rows.length === 0) return true; // liste vide = désactivée

    const ip = getClientIp(req);
    if (!ip) return false;
    return rows.some((row) => ipMatchesCidr(ip, row.cidr));
  } catch {
    return true;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

  if (pathname.startsWith("/api/admin")) {
    // Garde spécifique aux API admin (JWT en header + rôle + 2FA) : totalement
    // indépendante du cookie de session, elle authentifie via le header
    // Authorization. Pas d'appel à updateSession() ici : ce serait un
    // aller-retour Supabase Auth payé en plus, pour rien.
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

    if (!(await isIpAllowed(req))) {
      return NextResponse.json({ error: "IP non autorisée" }, { status: 403 });
    }

    // 2FA (TOTP) obligatoire pour tout compte admin, dès sa création (les
    // routes /api/auth/2fa/totp/* ne sont pas sous /api/admin/*, donc un admin
    // pas encore configuré peut toujours configurer son TOTP malgré ce blocage).
    if (!(await has2FASession(user.id, req))) {
      return NextResponse.json({ error: "2FA required" }, { status: 401 });
    }

    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    // Toutes les autres routes API s'authentifient par le header Authorization
    // (voir src/lib/apiAuth.ts), jamais par le cookie de session : inutile d'y
    // rafraîchir ce cookie. Vu en prod : ce rafraîchissement (un round-trip
    // Supabase Auth) tournait sur CHAQUE appel /api/* d'un enfant connecté
    // (suivi de progression, vérif badges, etc.), ajoutant une latence
    // perceptible à toutes les pages authentifiées malgré leur conversion en
    // composants serveur.
    return NextResponse.next();
  }

  // Pages : rafraîchit le cookie de session pour que createSupabaseServerClient()
  // voie une identité à jour dans les Server Components. Le chemin est aussi
  // exposé en header (illisible autrement dans un layout serveur) — utilisé
  // par src/app/admin/layout.tsx pour renvoyer vers /auth/2fa-verify avec le
  // bon `redirect=` plutôt qu'un /admin/dashboard fixe qui faisait perdre la
  // page demandée après une re-vérification 2FA.
  req.headers.set("x-pathname", pathname);
  return await updateSession(req);
}

export const config = {
  // Toutes les routes sauf les assets statiques : le matcher doit rester
  // large pour couvrir /api/admin/* (garde ci-dessus) et les pages
  // (rafraîchissement de session) — le tri entre les deux se fait dans la
  // fonction, pas dans le matcher.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

export default proxy;
