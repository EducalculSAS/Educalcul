import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// Use SUPABASE_SERVICE_ROLE (not NEXT_PUBLIC_) for server-side only
// Never evaluate this check in browser context - will always be undefined
const supabaseServiceRole = typeof window === 'undefined'
  ? process.env.SUPABASE_SERVICE_ROLE
  : null;

// ─── Public client (anon key) — browser + server ──────────────────────────
// One instance per JS context via globalThis to survive HMR re-evaluation.
const PUBLIC_KEY = "__sb_public__";
function getPublicClient(): SupabaseClient {
  if (!(globalThis as any)[PUBLIC_KEY]) {
    (globalThis as any)[PUBLIC_KEY] = createClient(supabaseUrl, supabaseAnonKey);
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
      url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith("/api/")) {
        const { data: { session } } = await getPublicClient().auth.getSession();
        const twoFAToken = window.localStorage.getItem("edu_2fa_token");
        if (session?.access_token || twoFAToken) {
          const headers = new Headers(
            init?.headers ?? (input instanceof Request ? input.headers : undefined)
          );
          if (session?.access_token && !headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${session.access_token}`);
          }
          // Jeton de session 2FA (voir src/lib/twoFactor.ts) — distinct du JWT
          // Supabase, requis en plus par apiAuth.ts pour les comptes qui ont
          // activé la 2FA (obligatoire pour les admins).
          if (twoFAToken && !headers.has("X-2FA-Token")) {
            headers.set("X-2FA-Token", twoFAToken);
          }
          init = { ...init, headers };
        }
      }
    } catch {
      // Never block a request because token retrieval failed.
    }
    const response = await originalFetch(input as any, init);
    // Un jeton 2FA présent en localStorage mais expiré/révoqué (TTL admin de
    // 4h) laisse admin/layout.tsx croire la 2FA validée (il ne vérifie que la
    // PRÉSENCE du jeton, pas sa validité) : la page s'affiche, puis chaque
    // appel /api/admin/* échoue en 401. Plutôt que de renvoyer vers une page
    // de re-vérification 2FA en pleine action (vécu comme un blocage confus),
    // on déconnecte proprement et on renvoie vers la connexion : l'admin se
    // reconnecte une fois, normalement, au lieu de re-suivre un flux 2FA isolé.
    if (
      response.status === 401 &&
      url.startsWith("/api/admin/") &&
      window.location.pathname.startsWith("/admin")
    ) {
      window.localStorage.removeItem("edu_2fa_token");
      getPublicClient().auth.signOut().finally(() => {
        window.location.href = `/auth/connexion?redirect=${encodeURIComponent(
          window.location.pathname,
        )}`;
      });
    } else if (
      response.status === 401 &&
      url.startsWith("/api/") &&
      !url.startsWith("/api/admin/") &&
      !window.location.pathname.startsWith("/admin")
    ) {
      // Espace élève/parent : ne jamais déconnecter de force sur une simple
      // session vieillissante — on laisse un composant applicatif (voir
      // SessionStillHereModal) proposer de confirmer sa présence et de
      // rafraîchir la session, sans interrompre l'action en cours.
      window.dispatchEvent(new CustomEvent("edu:session-check-needed"));
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
      console.error('[Supabase] FATAL: No SUPABASE_SERVICE_ROLE environment variable found. Admin operations will fail.');
      throw new Error('[Supabase] FATAL: Cannot initialize admin client without SUPABASE_SERVICE_ROLE');
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
