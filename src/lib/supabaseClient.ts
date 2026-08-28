import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// Use SUPABASE_SERVICE_ROLE (not NEXT_PUBLIC_) for server-side only
// Never evaluate this check in browser context - will always be undefined
const supabaseServiceRole =
  typeof window === "undefined" ? process.env.SUPABASE_SERVICE_ROLE : null;

// ─── Public client (anon key) — browser + server ──────────────────────────
// One instance per JS context via globalThis to survive HMR re-evaluation.
const PUBLIC_KEY = "__sb_public__";
function getPublicClient(): SupabaseClient {
  if (!(globalThis as any)[PUBLIC_KEY]) {
    // createBrowserClient (session en cookies, lisible par le serveur via
    // createSupabaseServerClient) UNIQUEMENT dans le navigateur : ce module
    // est importé par les ~100 routes /api/* pour supabaseAdmin, et son
    // évaluation exécute donc aussi cette ligne côté serveur à chaque fois.
    // createBrowserClient s'appuie sur `document.cookie`, absent en Node —
    // l'appeler côté serveur casserait toutes ces routes. Ce client "public"
    // n'est de toute façon jamais réellement utilisé côté serveur (seul
    // supabaseAdmin l'est) : createClient() y sert juste à ne rien casser.
    (globalThis as any)[PUBLIC_KEY] =
      typeof window === "undefined"
        ? createClient(supabaseUrl, supabaseAnonKey)
        : createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return (globalThis as any)[PUBLIC_KEY];
}

export const supabase: SupabaseClient = getPublicClient();

// ─── Attach the Supabase JWT to same-origin /api/ calls (browser only) ─────
// Server routes and the middleware authenticate requests via this header, so
// every page gets auth transparently without touching individual fetch calls.
const FETCH_PATCH_KEY = "__api_fetch_patched__";
if (typeof window !== "undefined" && !(window as any)[FETCH_PATCH_KEY]) {
  (window as any)[FETCH_PATCH_KEY] = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    let url = "";
    try {
      url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.startsWith("/api/")) {
        const {
          data: { session },
        } = await getPublicClient().auth.getSession();
        // Le jeton 2FA voyage désormais dans un cookie httpOnly (voir
        // src/lib/twoFactorCookie.ts) : le navigateur l'attache tout seul aux
        // requêtes same-origin, plus besoin de le lire/poser à la main ici
        // (et il n'est de toute façon plus lisible depuis ce JS).
        if (session?.access_token) {
          const headers = new Headers(
            init?.headers ??
              (input instanceof Request ? input.headers : undefined),
          );
          if (!headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${session.access_token}`);
          }
          init = { ...init, headers };
        }
      }
    } catch {
      // Never block a request because token retrieval failed.
    }
    const response = await originalFetch(input as any, init);
    // Un jeton 2FA expiré/révoqué côté serveur (TTL admin de 4h) laisse
    // AdminShell croire la 2FA validée tant qu'il n'a pas revérifié (voir
    // /api/auth/2fa/totp/verify-session) : sans ce filet, la page pourrait
    // s'afficher puis chaque appel /api/admin/* échouer en 401. Plutôt que de
    // renvoyer vers une page de re-vérification 2FA en pleine action (vécu
    // comme un blocage confus), on déconnecte proprement et on renvoie vers
    // la connexion : l'admin se reconnecte une fois, normalement.
    if (
      response.status === 401 &&
      url.startsWith("/api/admin/") &&
      window.location.pathname.startsWith("/admin") &&
      !url.includes("/api/auth/2fa/")
    ) {
      // Le flux 2FA admin est parfois temporairement invalide pendant la
      // vérification du cookie httpOnly ou la configuration : on ne doit pas
      // déconnecter immédiatement l'utilisateur et le renvoyer vers la page de
      // connexion. On le redirige vers le flux 2FA dédié, qui est le chemin
      // de récupération correct pour ce cas.
      const redirect = encodeURIComponent(
        window.location.pathname || "/admin/dashboard",
      );
      window.location.href = `/auth/2fa-verify?redirect=${redirect}`;
    } else if (
      response.status === 401 &&
      url.startsWith("/api/") &&
      !url.startsWith("/api/admin/") &&
      !window.location.pathname.startsWith("/admin")
    ) {
      // Espace élève/parent : ne jamais déconnecter de force sur une simple
      // session vieillissante. On tente un rafraîchissement silencieux du
      // jeton en arrière-plan (sans interrompre l'action). La déconnexion sur
      // inactivité réelle est gérée séparément par SessionStillHereModal.
      getPublicClient().auth.refreshSession().catch(() => {});
    }
    return response;
  }) as typeof fetch;
}

// ─── Admin client (service role) — SERVER ONLY ────────────────────────────
// Never instantiate in browser: would create a second GoTrueClient.
const ADMIN_KEY = "__sb_admin__";
function getAdminClient(): SupabaseClient {
  // Guard: in browser, return the public client to avoid duplicate GoTrueClient.
  // API routes / server components never have `window`.
  if (typeof window !== "undefined") return supabase;

  if (!(globalThis as any)[ADMIN_KEY]) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE;
    if (!serviceKey) {
      console.error(
        "[Supabase] FATAL: No SUPABASE_SERVICE_ROLE environment variable found. Admin operations will fail.",
      );
      throw new Error(
        "[Supabase] FATAL: Cannot initialize admin client without SUPABASE_SERVICE_ROLE",
      );
    }
    (globalThis as any)[ADMIN_KEY] = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return (globalThis as any)[ADMIN_KEY];
}

// Lazy proxy: the admin client is only created on first real use, so a missing
// SUPABASE_SERVICE_ROLE breaks admin operations — not every public page.
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getAdminClient() as any;
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
