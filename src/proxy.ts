import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { updateSession } from "@/lib/supabase/middleware";
import { ipMatchesCidr } from "@/lib/adminIpAllowlist";
import { getClientIp } from "@/lib/ipGeo";

function dashboardPathForRole(role: string): string {
  if (role === "parent") return "/parent/dashboard";
  if (role === "child") return "/child/dashboard";
  if (role === "admin") return "/admin/dashboard";
  return "/dashboard";
}

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

// Plus aucune route /api/admin/* n'est lisible par un simple utilisateur
// connecté. Les lectures de /api/admin/{courses,exercises,quizzes} l'étaient :
// un élève pouvait y lire TOUT le contenu non publié (brouillons), et ces
// lectures passaient AVANT les contrôles de liste d'IP et de 2FA admin. Aucun
// écran non-admin ne les appelle plus — les pages élève chargent leur
// contenu côté serveur.

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

    // Envoi d'avatar : tout utilisateur connecté non banni (la route force
    // alors le dossier avatars/).
    const isUserLevel = method === "POST" && pathname === "/api/admin/upload";
    if (isUserLevel) return NextResponse.next();

    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!(await isIpAllowed(req))) {
      return NextResponse.json({ error: "IP non autorisée" }, { status: 403 });
    }

    // 2FA obligatoire pour tout compte admin, dès sa création : un admin sans
    // TOTP passe par le code e-mail, puis configure son TOTP (routes
    // /api/auth/2fa/totp/*, hors de /api/admin/*).
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

  // Page d'accueil : un utilisateur déjà connecté (cookie de session valide)
  // qui la rouvre (nouvel onglet, navigateur relancé) est envoyé directement
  // sur son tableau de bord plutôt que sur la vitrine publique — sinon rien
  // ne distingue visuellement un compte connecté d'un visiteur anonyme sur
  // cette page, ce qui donne l'impression trompeuse d'avoir été déconnecté.
  if (pathname === "/" && req.method === "GET") {
    const supabase = createServerClient(SUPABASE_URL, ANON_KEY, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {},
      },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const roleInfo = await getRole(user.id);
      // Les admins ne sont jamais auto-redirigés : l'accès à /admin/dashboard
      // passe toujours par une navigation explicite (+ re-vérification 2FA),
      // pas par un simple cookie de session retrouvé sur la page d'accueil.
      if (roleInfo && roleInfo.role !== "admin") {
        return NextResponse.redirect(new URL(dashboardPathForRole(roleInfo.role), req.url));
      }
    }
  }

  // Pages : rafraîchit le cookie de session pour que createSupabaseServerClient()
  // voie une identité à jour dans les Server Components. Le chemin est aussi
  // exposé en header (illisible autrement dans un layout serveur) — utilisé
  // par src/app/admin/layout.tsx pour renvoyer vers /auth/2fa-verify avec le
  // bon `redirect=` plutôt qu'un /admin/dashboard fixe qui faisait perdre la
  // page demandée après une re-vérification 2FA.
  req.headers.set("x-pathname", pathname);
  const { response, authId } = await updateSession(req);

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return guardAdminPage(req, response, authId);
  }
  return response;
}

/**
 * Garde des PAGES admin, ici et pas seulement dans src/app/admin/layout.tsx.
 *
 * Next.js ne ré-exécute pas un layout lors d'une navigation entre pages qui le
 * partagent : une requête RSC qui prétend venir de /admin/dashboard (en-tête
 * Next-Router-State-Tree) fait rendre /admin/users SANS le layout. Vérifié :
 * sans aucune connexion, cette requête renvoyait les données que les pages
 * admin chargent côté serveur avec la clé de service. Le proxy, lui, voit
 * passer toutes les requêtes.
 *
 * Même exigence que /api/admin/* : rôle admin, compte non banni, session 2FA
 * valide (y compris pour un admin qui n'a pas encore configuré son TOTP : il
 * passe d'abord par le code e-mail), liste d'IP.
 */
async function guardAdminPage(req: NextRequest, response: NextResponse, authId: string | null): Promise<NextResponse> {
  // La redirection doit emporter les cookies de session éventuellement
  // rafraîchis par updateSession, sinon la page suivante verrait un jeton périmé.
  const redirectTo = (path: string) => {
    const res = NextResponse.redirect(new URL(path, req.url));
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!authId) return redirectTo("/auth/connexion");
  const user = await getRole(authId);
  if (!user) return redirectTo("/auth/connexion");
  if (user.role !== "admin") return redirectTo(dashboardPathForRole(user.role));

  const [twoFactorOk, ipOk] = await Promise.all([has2FASession(user.id, req), isIpAllowed(req)]);
  if (!ipOk) return new NextResponse("Accès admin refusé depuis cette adresse IP.", { status: 403 });
  if (!twoFactorOk) {
    return redirectTo(`/auth/2fa-verify?redirect=${encodeURIComponent(req.nextUrl.pathname)}`);
  }
  return response;
}

export const config = {
  // Toutes les routes sauf les assets statiques : le matcher doit rester
  // large pour couvrir /api/admin/* (garde ci-dessus) et les pages
  // (rafraîchissement de session) — le tri entre les deux se fait dans la
  // fonction, pas dans le matcher.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

export default proxy;
