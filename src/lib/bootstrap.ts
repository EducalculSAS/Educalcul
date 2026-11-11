/**
 * Lecture groupée de l'ouverture d'une page connectée (voir /api/user/bootstrap) : profil, abonnement, notifications
 * et messages de l'équipe en un seul appel, partagé par tous les composants de la page et gardé quelques secondes.
 * Les rafraîchissements ciblés (après une modification, sondage des notifications) gardent leur route propre.
 */
export interface Bootstrap {
  profile: Record<string, unknown> | null;
  subscription: unknown | null;
  notifications: unknown[] | null;
  adminMessages: unknown[] | null;
}

const TTL_MS = 5_000;
let shared: { at: number; promise: Promise<Bootstrap | null> } | null = null;

export function getBootstrap(): Promise<Bootstrap | null> {
  if (!shared || Date.now() - shared.at > TTL_MS) {
    const promise = fetch("/api/user/bootstrap")
      .then((res) => (res.ok ? (res.json() as Promise<Bootstrap>) : null))
      .catch(() => null);
    shared = { at: Date.now(), promise };
    // Un échec ne reste pas en cache.
    void promise.then((v) => { if (v === null) shared = null; });
  }
  return shared.promise;
}

/** À appeler après une écriture : la prochaine lecture repart du serveur. */
export function invalidateBootstrap(): void {
  shared = null;
}
