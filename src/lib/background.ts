import { after } from "next/server";

/**
 * Travail lancé APRÈS avoir répondu (e-mail, notification…) : `after` garde la
 * fonction en vie jusqu'à la fin de la promesse. Sans lui, sur Vercel, une
 * promesse lancée sans être attendue peut être coupée dès que la réponse est
 * partie, et l'e-mail ne part jamais. Hors requête (scripts, tests), on laisse
 * simplement la promesse se terminer seule.
 */
export function runAfterResponse(work: PromiseLike<unknown>) {
  try {
    after(() => work);
  } catch {
    void Promise.resolve(work).catch(() => undefined);
  }
}
