/**
 * Input validation and sanitization utilities
 * Prevents XSS, injection attacks, and data validation issues
 */

// UUID v4 pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate UUID format
 */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Validate numeric ID
 */
export function isValidNumericId(value: unknown): boolean {
  const num = Number(value);
  return !isNaN(num) && num > 0 && Number.isInteger(num);
}

/**
 * Validate and sanitize email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return email.length <= 255 && emailRegex.test(email);
}

/** Alias for isValidEmail */
export const validateEmail = isValidEmail;

/**
 * Validate string with max length (prevents DoS)
 */
export function validateString(value: unknown, maxLength: number = 5000): string | null {
  if (typeof value !== 'string') return null;
  if (value.length === 0 || value.length > maxLength) return null;
  return value.trim();
}

/**
 * Validate name fields (first_name, last_name, etc)
 */
export function validateName(name: unknown, maxLength: number = 100): string | null {
  const validated = validateString(name, maxLength);
  if (!validated) return null;
  // Allow only letters, spaces, hyphens, apostrophes
  if (!/^[a-zA-ZÀ-ÿ\s\-']+$/.test(validated)) return null;
  return validated;
}

/**
 * Validate username (alphanumeric, underscore, hyphen)
 */
export function validateUsername(username: unknown, maxLength: number = 50): string | null {
  const validated = validateString(username, maxLength);
  if (!validated) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(validated)) return null;
  if (validated.length < 3) return null;
  return validated;
}

/**
 * Sanitize string for safe HTML/JSON output (basic)
 * For full protection, use a library like DOMPurify on client or sanitize-html on server
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Validate URL path to prevent directory traversal
 */
export function isValidUrlPath(path: string): boolean {
  // Reject paths with .. or absolute paths
  if (path.includes('..') || path.startsWith('/')) return false;
  // Allow alphanumeric, underscore, hyphen, and "/" as a subfolder separator
  // (each segment still restricted to the same safe character set).
  return /^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*$/.test(path);
}

/**
 * Validate role
 */
export function isValidRole(role: unknown, allowedRoles: string[] = ['parent', 'child', 'admin']): boolean {
  return typeof role === 'string' && allowedRoles.includes(role);
}

/**
 * Validate password strength: at least 10 characters, with a mix of letters
 * and digits (or symbols). Returns an error message in French, or null if valid.
 */
export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length === 0) {
    return "Le mot de passe est requis.";
  }
  if (password.length < 10) {
    return "Le mot de passe doit contenir au moins 10 caractères.";
  }
  if (password.length > 128) {
    return "Le mot de passe est trop long.";
  }
  const hasLetter = /[a-zA-ZÀ-ÿ]/.test(password);
  const hasDigitOrSymbol = /[0-9!-\/:-@\[-`{-~]/.test(password);
  if (!hasLetter || !hasDigitOrSymbol) {
    return "Le mot de passe doit contenir des lettres et au moins un chiffre ou un symbole.";
  }
  return null;
}