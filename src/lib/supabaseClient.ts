import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// Use SUPABASE_SERVICE_ROLE (not NEXT_PUBLIC_) for server-side only
// Never evaluate this check in browser context - will always be undefined
const supabaseServiceRole = typeof window === 'undefined' 
  ? (process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE)
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

// ─── Admin client (service role) — SERVER ONLY ────────────────────────────
// Never instantiate in browser: would create a second GoTrueClient.
const ADMIN_KEY = "__sb_admin__";
function getAdminClient(): SupabaseClient {
  // Guard: in browser, return the public client to avoid duplicate GoTrueClient.
  // API routes / server components never have `window`.
  if (typeof window !== "undefined") return supabase;

  if (!(globalThis as any)[ADMIN_KEY]) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE;
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

export const supabaseAdmin: SupabaseClient = getAdminClient();
