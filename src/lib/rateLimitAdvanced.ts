/**
 * Advanced rate limiting with different strategies per endpoint
 * Prevents brute force, DoS, and API abuse
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
  blocked?: boolean;
  blockedUntil?: number;
}

const attempts = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60000; // 1 minute
let lastCleanup = Date.now();

/**
 * Clean up expired entries
 */
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  for (const [key, entry] of attempts.entries()) {
    if (now > entry.resetAt && (!entry.blockedUntil || now > entry.blockedUntil)) {
      attempts.delete(key);
    }
  }
  
  lastCleanup = now;
}

/**
 * Rate limit with exponential backoff
 */
export function rateLimitWithBackoff(
  key: string,
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000, // 15 min
  maxFailures = 10, // After this many resets, block for longer
  blockDurationMs = 60 * 60 * 1000 // 1 hour block
): { allowed: boolean; remaining: number; resetIn: number; blocked?: boolean; blockedUntil?: number } {
  cleanup();
  
  const now = Date.now();
  const entry = attempts.get(key) || { count: 0, resetAt: now + windowMs };
  
  // Check if user is blocked
  if (entry.blocked && entry.blockedUntil && now < entry.blockedUntil) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.blockedUntil - now,
      blocked: true,
      blockedUntil: entry.blockedUntil,
    };
  }
  
  // Reset block if time passed
  if (entry.blocked && entry.blockedUntil && now >= entry.blockedUntil) {
    entry.blocked = false;
    entry.blockedUntil = undefined;
  }
  
  // Check if in current window
  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + windowMs;
    attempts.set(key, entry);
    return { allowed: true, remaining: maxAttempts - 1, resetIn: windowMs };
  }
  
  // If exceeding max attempts
  if (entry.count >= maxAttempts) {
    // Count total resets
    const resetCount = Math.floor(Date.now() / windowMs) - Math.floor(entry.resetAt / windowMs);
    
    // Block if too many failures
    if (resetCount >= maxFailures) {
      entry.blocked = true;
      entry.blockedUntil = now + blockDurationMs;
      attempts.set(key, entry);
      
      return {
        allowed: false,
        remaining: 0,
        resetIn: entry.blockedUntil - now,
        blocked: true,
        blockedUntil: entry.blockedUntil,
      };
    }
    
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
  }
  
  entry.count++;
  attempts.set(key, entry);
  return { allowed: true, remaining: maxAttempts - entry.count, resetIn: entry.resetAt - now };
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
  'ai:edit': { maxAttempts: 20, windowMs: 60 * 60 * 1000, name: 'AI Edit' },
  'ai:generate': { maxAttempts: 15, windowMs: 60 * 60 * 1000, name: 'AI Generate' },
  'ai:grade': { maxAttempts: 60, windowMs: 60 * 60 * 1000, name: 'AI Grading' },
  
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
export function resetRateLimit(key: string) {
  attempts.delete(key);
}
