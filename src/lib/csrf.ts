/**
 * CSRF Token generation and validation
 * Prevents Cross-Site Request Forgery attacks
 */

import { webcrypto } from 'crypto';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_TTL = 1000 * 60 * 60; // 1 hour

// In-memory CSRF token store (in production, use Redis or database)
const csrfTokens = new Map<string, { token: string; createdAt: number }>();

/**
 * Generate a new CSRF token
 */
export async function generateCsrfToken(): Promise<string> {
  const buffer = await webcrypto.getRandomValues(new Uint8Array(CSRF_TOKEN_LENGTH));
  const token = Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Store token with TTL
  const sessionId = `csrf_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  csrfTokens.set(sessionId, { token, createdAt: Date.now() });
  
  // Cleanup old tokens
  const now = Date.now();
  for (const [key, value] of csrfTokens.entries()) {
    if (now - value.createdAt > CSRF_TOKEN_TTL) {
      csrfTokens.delete(key);
    }
  }
  
  return token;
}

/**
 * Validate CSRF token
 */
export function validateCsrfToken(token: string, storedToken?: string): boolean {
  if (!token || !storedToken) return false;
  
  // Constant-time comparison to prevent timing attacks
  if (token.length !== storedToken.length) return false;
  
  let valid = true;
  for (let i = 0; i < token.length; i++) {
    if (token.charCodeAt(i) !== storedToken.charCodeAt(i)) {
      valid = false;
    }
  }
  
  return valid;
}

/**
 * Extract CSRF token from request headers or body
 */
export function extractCsrfToken(req: Request, body?: any): string | null {
  // Check header first (X-CSRF-Token or X-CSRF-TOKEN)
  let token = req.headers.get('x-csrf-token');
  if (!token) token = req.headers.get('x-csrf-TOKEN');
  
  // Check body if provided
  if (!token && body && typeof body === 'object') {
    token = body._csrf || body.csrfToken || null;
  }
  
  return token;
}
