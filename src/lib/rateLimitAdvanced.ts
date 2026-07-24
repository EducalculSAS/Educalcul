/**
 * Advanced rate limiting with different strategies per endpoint
 * Prevents brute force, DoS, and API abuse
 *
 * Backed by the `rate_limits` table + `check_rate_limit` Postgres function
 * (atomic, row-locked) rather than in-process memory: on Vercel serverless,
 * each invocation can land on a different instance with its own memory, so
 * an in-memory counter does not actually limit anything across requests.
 */
import { supabaseAdmin } from "./supabaseClient";

/**
 * Rate limit with exponential backoff
 */
export async function rateLimitWithBackoff(
  key: string,
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000, // 15 min
  maxFailures = 10, // After this many resets, block for longer
  blockDurationMs = 60 * 60 * 1000 // 1 hour block
): Promise<{ allowed: boolean; remaining: number; resetIn: number; blocked?: boolean; blockedUntil?: number }> {
  const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
    p_key: key,
    p_max_attempts: maxAttempts,
    p_window_ms: windowMs,
    p_max_failures: maxFailures,
    p_block_duration_ms: blockDurationMs,
  });

  const row = data?.[0];
  if (error || !row) {
    // Fail open: an unreachable DB shouldn't take the whole app down, but
    // this silently disables rate-limiting until the underlying issue is
    // fixed, so it's logged loudly.
    console.error("[rateLimitWithBackoff] DB error, failing open:", error?.message);
    return { allowed: true, remaining: maxAttempts, resetIn: windowMs };
  }

  return {
    allowed: row.allowed,
    remaining: row.remaining,
    resetIn: Number(row.reset_in),
    blocked: row.blocked,
    blockedUntil: row.blocked_until ? new Date(row.blocked_until).getTime() : undefined,
  };
}

/**
 * Endpoint-specific rate limit configurations
 */
export const RATE_LIMITS = {
  // Auth endpoints - strict
  'auth:signup': { maxAttempts: 5, windowMs: 60 * 60 * 1000, name: 'Signup' },
  'auth:login': { maxAttempts: 10, windowMs: 15 * 60 * 1000, name: 'Login' },
  'auth:validate-email': { maxAttempts: 20, windowMs: 60 * 60 * 1000, name: 'Email validation' },
  'auth:resolve-username': { maxAttempts: 30, windowMs: 60 * 1000, name: 'Username resolution' },
  'auth:forgot-password': { maxAttempts: 5, windowMs: 60 * 60 * 1000, name: 'Password reset' },
  
  // Public endpoints - moderate
  'contact:form': { maxAttempts: 5, windowMs: 60 * 60 * 1000, name: 'Contact form' },
  'waitlist:join': { maxAttempts: 10, windowMs: 60 * 60 * 1000, name: 'Waitlist' },
  'support:ticket': { maxAttempts: 10, windowMs: 60 * 60 * 1000, name: 'Support ticket' },
  
  // AI endpoints - strict (expensive)
  'ai:tutor': { maxAttempts: 30, windowMs: 60 * 60 * 1000, name: 'AI Tutor' },
  'ai:parent-support': { maxAttempts: 30, windowMs: 60 * 60 * 1000, name: 'Parent support chat' },
  'ai:edit': { maxAttempts: 20, windowMs: 60 * 60 * 1000, name: 'AI Edit' },
  'ai:generate': { maxAttempts: 15, windowMs: 60 * 60 * 1000, name: 'AI Generate' },
  'ai:grade': { maxAttempts: 60, windowMs: 60 * 60 * 1000, name: 'AI Grading' },

  // Admin AI endpoints - generous (production tool, only reachable by an
  // authenticated admin via proxy.ts). Not meant to throttle normal usage —
  // just a backstop against a compromised token or a runaway client bug.
  'ai:admin': { maxAttempts: 300, windowMs: 60 * 60 * 1000, name: 'Admin AI generation' },

  // Démo publique (page epsi) - plafond large PAR IP, en complément (pas en
  // remplacement) du compteur par cookie qui reste la limite principale de
  // 3 messages. L'IP n'est délibérément pas utilisée comme identifiant
  // principal (NAT partagé, spoofable, change de réseau) — seulement comme
  // garde-fou grossier contre un script qui régénère des cookies en boucle.
  'epsi:demo': { maxAttempts: 30, windowMs: 60 * 60 * 1000, name: 'EPSI demo' },

  // File upload
  'upload:file': { maxAttempts: 50, windowMs: 60 * 60 * 1000, name: 'File upload' },
  
  // Forum - moderate
  'forum:post': { maxAttempts: 20, windowMs: 60 * 60 * 1000, name: 'Forum post' },
  'forum:comment': { maxAttempts: 50, windowMs: 60 * 60 * 1000, name: 'Forum comment' },
  
  // Webhooks - very strict
  'webhook:stripe': { maxAttempts: 100, windowMs: 60 * 60 * 1000, name: 'Stripe webhook' },
};

/**
 * Get rate limit config by endpoint key
 */
export function getRateLimitConfig(endpointKey: string) {
  return RATE_LIMITS[endpointKey as keyof typeof RATE_LIMITS] || {
    maxAttempts: 100,
    windowMs: 60 * 60 * 1000,
    name: 'API Call',
  };
}

/**
 * Reset rate limit for a key (e.g., after successful auth)
 */
export async function resetRateLimit(key: string) {
  await supabaseAdmin.from("rate_limits").delete().eq("key", key);
}
