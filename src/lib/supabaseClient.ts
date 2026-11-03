import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// La clé de service (SUPABASE_SERVICE_ROLE, jamais NEXT_PUBLIC_) n'est lue que côté serveur, dans getSupabaseAdmin() plus bas.

/** Registre global (survit au rechargement à chaud) : un seul client par contexte JS. */
const globalStore = globalThis as unknown as Record<string, SupabaseClient | boolean | undefined>;

// ─── Public client (anon key) — browser + server ──────────────────────────
// One instance per JS context via globalThis to survive HMR re-evaluation.
const PUBLIC_KEY = "__sb_public__";
function getPublicClient(): SupabaseClient {
  if (!globalStore[PUBLIC_KEY]) {
    // createBrowserClient (session en cookies, lisible par le serveur via
    // createSupabaseServerClient) UNIQUEMENT dans le navigateur : ce module
    // est importé par les ~100 routes /api/* pour supabaseAdmin, et son
    // évaluation exécute donc aussi cette ligne côté serveur à chaque fois.
    // createBrowserClient s'appuie sur `document.cookie`, absent en Node —
    // l'appeler côté serveur casserait toutes ces routes. Ce client "public"
    // n'est de toute façon jamais réellement utilisé côté serveur (seul
    // supabaseAdmin l'est) : createClient() y sert juste à ne rien casser.
    globalStore[PUBLIC_KEY] =
      typeof window === "undefined"
        ? createClient(supabaseUrl, supabaseAnonKey)
        : createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return globalStore[PUBLIC_KEY] as SupabaseClient;
}

export const supabase: SupabaseClient = getPublicClient();

// ─── Attach the Supabase JWT to same-origin /api/ calls (browser only) ─────
// Server routes and the middleware authenticate requests via this header, so
// every page gets auth transparently without touching individual fetch calls.
const FETCH_PATCH_KEY = "__api_fetch_patched__";
if (typeof window !== "undefined" && !globalStore[FETCH_PATCH_KEY]) {
  globalStore[FETCH_PATCH_KEY] = true;
  const originalFetch = window.fetch.bind(window);

  const targetUrl = (input: RequestInfo | URL): string => {
    try {
      if (typeof input === "string") return input;
      if (input instanceof URL) return input.href;
      return (input as Request).url;
    } catch {
      return "";
    }
  };

  // Jeton de la session en mémoire, tenu à jour par onAuthStateChange. getSession() prend le verrou d'authentification
  // du navigateur : en l'appelant avant CHAQUE requête /api/*, les appels simultanés d'une page se bousculaient pour ce
  // verrou (« Lock was stolen by another request »). On ne s'y adresse que si le jeton manque ou expire dans moins de 30 s.
  let cachedToken: { value: string; expiresAt: number } | null = null;
  getPublicClient().auth.onAuthStateChange((_event, session) => {
    cachedToken = session?.access_token ? { value: session.access_token, expiresAt: (session.expires_at ?? 0) * 1000 } : null;
  });

  const withAuthHeader = async (
    input: RequestInfo | URL,
    init: RequestInit | undefined,
  ): Promise<RequestInit | undefined> => {
    try {
      let accessToken: string | undefined;
      if (cachedToken && cachedToken.expiresAt - Date.now() > 30_000) {
        accessToken = cachedToken.value;
      } else {
        const {
          data: { session },
        } = await getPublicClient().auth.getSession();
        accessToken = session?.access_token;
      }
      // Le jeton 2FA voyage désormais dans un cookie httpOnly (voir
      // src/lib/twoFactorCookie.ts) : le navigateur l'attache tout seul aux
      // requêtes same-origin, plus besoin de le lire/poser à la main ici
      // (et il n'est de toute façon plus lisible depuis ce JS).
      if (accessToken) {
        const headers = new Headers(
          init?.headers ??
            (input instanceof Request ? input.headers : undefined),
        );
        headers.set("Authorization", `Bearer ${accessToken}`);
        return { ...init, headers };
      }
    } catch {
      // Never block a request because token retrieval failed.
    }
    return init;
  };

  const apiFetch = async (
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    url: string,
    isRetry = false,
  ): Promise<Response> => {
    if (!isRetry) init = await withAuthHeader(input, init);
    const response = await originalFetch(input, init);
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
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- 2FA requise : rechargement complet vers la vérification
      window.location.href = `/auth/2fa-verify?redirect=${redirect}`;
    } else if (
      response.status === 401 &&
      url.startsWith("/api/") &&
      !url.startsWith("/api/admin/") &&
      !window.location.pathname.startsWith("/admin") &&
      !isRetry
    ) {
      // Espace élève/parent : ne jamais déconnecter de force sur une simple
      // session vieillissante. Cas fréquent juste après une connexion
      // fraîche — le token vient d'être émis pendant qu'un refresh
      // s'enclenche déjà en arrière-plan côté client Supabase, et cette
      // requête peut partir avec un jeton pas encore à jour : on rafraîchit
      // puis on retente UNE fois avec le nouveau jeton avant d'abandonner
      // (la déconnexion sur inactivité réelle reste gérée par
      // SessionStillHereModal, pas ici).
      const { data } = await getPublicClient().auth.refreshSession().catch(() => ({ data: null }));
      if (data?.session?.access_token) {
        cachedToken = { value: data.session.access_token, expiresAt: (data.session.expires_at ?? 0) * 1000 };
        const retryInit = await withAuthHeader(input, init);
        return apiFetch(input, retryInit, url, true);
      }
    }
    return response;
  };

  // Seules les requêtes vers nos routes /api/ passent par le wrapper (auth +
  // gestion des 401). Tout le reste — HMR de Turbopack, préchargement RSC de
  // Next, appels internes du client Supabase (auth/realtime), images... — est
  // renvoyé au fetch natif tel quel.
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = targetUrl(input);
    if (url.startsWith("/api/")) return apiFetch(input, init, url);
    return originalFetch(input, init);
  }) as typeof fetch;

  // « Failed to fetch » = échec de la COUCHE RÉSEAU (hors-ligne, DNS, CORS,
  // requête annulée, HMR/serveur dev qui redémarre, rafraîchissement de jeton
  // Supabase pendant une coupure). Ce n'est jamais une erreur HTTP applicative
  // (celles-là arrivent avec un vrai Response). Le code qui doit réagir à une
  // panne réseau a déjà son try/catch ; une rejection *non gérée* de ce type
  // n'est que du bruit (overlay Next en dev, console.error en prod). On la
  // neutralise, sans toucher aux erreurs réellement traitées.
  const isNetworkFailure = (reason: unknown): boolean => {
    const err = reason as { name?: string; message?: string } | null;
    return (
      !!err &&
      err.name === "TypeError" &&
      typeof err.message === "string" &&
      /fetch|network|load failed/i.test(err.message)
    );
  };
  window.addEventListener(
    "unhandledrejection",
    (event) => {
      if (isNetworkFailure(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
}

// ─── Admin client (service role) — SERVER ONLY ────────────────────────────
// Never instantiate in browser: would create a second GoTrueClient.
const ADMIN_KEY = "__sb_admin__";
function getAdminClient(): SupabaseClient {
  // Guard: in browser, return the public client to avoid duplicate GoTrueClient.
  // API routes / server components never have `window`.
  if (typeof window !== "undefined") return supabase;

  if (!globalStore[ADMIN_KEY]) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE;
    if (!serviceKey) {
      console.error(
        "[Supabase] FATAL: No SUPABASE_SERVICE_ROLE environment variable found. Admin operations will fail.",
      );
      throw new Error(
        "[Supabase] FATAL: Cannot initialize admin client without SUPABASE_SERVICE_ROLE",
      );
    }
    globalStore[ADMIN_KEY] = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return globalStore[ADMIN_KEY] as SupabaseClient;
}

// Lazy proxy: the admin client is only created on first real use, so a missing
// SUPABASE_SERVICE_ROLE breaks admin operations — not every public page.
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getAdminClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
