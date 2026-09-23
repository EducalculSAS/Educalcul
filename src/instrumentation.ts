import type { Instrumentation } from "next";

/**
 * Erreurs du serveur (pages, routes API, actions) → journal d'erreurs maison
 * (src/lib/errorLog.ts, visible dans Admin > Erreurs). Import dynamique :
 * ce fichier est aussi chargé par le runtime Edge, qui n'a pas accès à la base.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const error = err as Error & { digest?: string };
  const { recordError } = await import("@/lib/errorLog");
  await recordError({
    source: "server",
    message: error?.message || String(err),
    stack: error?.stack ?? null,
    url: `${request.method} ${request.path}`,
    userAgent: (request.headers["user-agent"] as string | undefined) ?? null,
  });
};
