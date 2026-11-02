/**
 * Safe error handling to prevent information disclosure
 * Always returns generic messages to client, logs full errors server-side
 */


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
