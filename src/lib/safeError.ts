/**
 * Safe error handling to prevent information disclosure
 * Always returns generic messages to client, logs full errors server-side
 */

import type { Loose } from "@/types/loose";
export interface SafeErrorOptions {
  statusCode?: number;
  logError?: boolean;
  context?: string;
}

/**
 * Safely handle and return errors without exposing sensitive information
 */
export function handleError(
  error: Loose,
  options: SafeErrorOptions = {}
): Response {
  const {
    statusCode = 500,
    logError = true,
    context = "Unknown",
  } = options;

  // Log full error server-side
  if (logError) {
    console.error(`[${context}] Error:`, error);
  }

  // Return generic error message to client
  const genericMessages: Record<number, string> = {
    400: "Invalid request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not found",
    409: "Conflict",
    429: "Too many requests",
    500: "Internal server error",
    503: "Service unavailable",
  };

  return new Response(
    JSON.stringify({
      error: genericMessages[statusCode] || "An error occurred",
    }),
    {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * Safely validate and extract ID from request
 */
export function extractAndValidateId(
  id: string | null,
  type: "numeric" | "uuid" = "numeric"
): string | null {
  if (!id) return null;

  if (type === "numeric") {
    const num = Number(id);
    if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
      return null;
    }
    return String(num);
  }

  // UUID validation
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return null;
  }

  return id;
}

/**
 * Safely extract and validate role from request
 */
export function extractAndValidateRole(role: Loose): string | null {
  const validRoles = ["parent", "child", "admin"];
  return validRoles.includes(role) ? role : null;
}

/**
 * Sanitize error message to prevent leaking database schema or sensitive info
 */
export function sanitizeErrorMessage(message: string): string {
  // Remove PostgreSQL error details
  if (message.includes("duplicate key") || message.includes("unique")) {
    return "This resource already exists";
  }
  if (message.includes("foreign key")) {
    return "Invalid reference";
  }
  if (message.includes("not found")) {
    return "Resource not found";
  }

  // Return generic message for any other database error
  return "Operation failed";
}

/** Message lisible d'une erreur interceptée (`catch (e: unknown)`) : `Error.message`, sinon le texte, sinon `fallback`. */
export function errMessage(e: unknown, fallback = ""): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") return (e as { message: string }).message;
  return fallback;
}
