/**
 * Erreurs des navigateurs → /api/errors (journal d'erreurs maison, voir
 * src/lib/errorLog.ts). Une même erreur n'est envoyée qu'une fois par page,
 * et au plus 10 erreurs par page : un bug en boucle ne noie pas le serveur.
 */
import { isNoiseError } from "@/lib/errorNoise";

const sent = new Set<string>();

export function reportClientError(message: string, stack?: string | null) {
  try {
    const key = `${message}|${(stack ?? "").slice(0, 200)}`;
    if (!message || sent.has(key) || sent.size >= 10) return;
    // Bruit sans conséquence (extensions, réseau, anciennes versions du site) : même liste que le serveur.
    if (isNoiseError({ message, stack, url: location.pathname })) return;
    sent.add(key);
    const body = JSON.stringify({ message: message.slice(0, 1000), stack: stack?.slice(0, 6000) ?? null, url: location.pathname });
    fetch("/api/errors", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    // jamais d'erreur à cause du rapport d'erreur
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => reportClientError(e.message || String(e.error), e.error?.stack));
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason as { message?: string; stack?: string } | string | undefined;
    reportClientError(typeof r === "string" ? r : r?.message || "Promesse rejetée", typeof r === "object" ? r?.stack : null);
  });
}
