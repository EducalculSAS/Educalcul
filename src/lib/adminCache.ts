// Cache mémoire (module-level, survit tant que l'onglet reste ouvert) pour
// les listes des pages admin. Objectif : en revenant sur une page déjà
// visitée (ex. Exercices → Quiz → Exercices), on affiche INSTANTANÉMENT les
// dernières données connues au lieu d'un écran de chargement vide, pendant
// qu'une requête fraîche part en arrière-plan pour remettre l'affichage à jour.
const store = new Map<string, unknown>();

export function getAdminCache<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function setAdminCache(key: string, data: unknown): void {
  store.set(key, data);
}

// À appeler quand on sait qu'une entrée est périmée (ex: après une
// création/suppression) pour forcer un vrai rechargement la prochaine fois.
export function invalidateAdminCache(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
