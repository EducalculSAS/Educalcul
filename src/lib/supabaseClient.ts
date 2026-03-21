import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRole = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE || '';

// Singleton implementation to avoid multiple GoTrueClient warnings in dev
const getSupabaseClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) return null as any;
  if (!(globalThis as any).supabaseClient) {
    (globalThis as any).supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return (globalThis as any).supabaseClient;
};

// Client for client-side operations (uses Anon Key)
export const supabase = getSupabaseClient();

const getSupabaseAdminClient = () => {
  if (!supabaseUrl || !supabaseServiceRole) return null as any;
  if (!(globalThis as any).supabaseAdminClient) {
    (globalThis as any).supabaseAdminClient = createClient(supabaseUrl, supabaseServiceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return (globalThis as any).supabaseAdminClient;
};

// Client for server-side admin operations (uses Service Role Key)
// WARNING: Only use this in secure server-side contexts (API routes, Server Components)
export const supabaseAdmin = getSupabaseAdminClient();
