/**
 * Filtre « dossier courant » des listes admin (cours, exercices, quiz).
 *
 * Sans lui, chaque ouverture de dossier téléchargeait TOUT le contenu (7 560
 * exercices, 8 requêtes paginées en série) pour n'en garder qu'une dizaine
 * côté navigateur. Le paramètre `folder` vaut :
 *   - "root"  → éléments rangés à la racine (folder_id IS NULL) ;
 *   - un id   → éléments de ce dossier ;
 *   - absent  → aucun filtre (comportement historique, conservé pour les
 *               appelants qui veulent vraiment tout, comme les exports).
 */
export type FolderParam = number | "root" | null;

export function parseFolderParam(value: string | null): FolderParam {
  if (value === "root") return "root";
  if (value === null || value === "") return null;
  const id = Number(value);
  // Tout ce qui n'est pas un entier positif est ignoré plutôt que transmis tel
  // quel à la requête.
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Typage volontairement structurel : le même filtre s'applique aux builders
// PostgREST des trois tables sans dépendre de leurs types générés.
interface FilterableQuery<Q> {
  is(column: string, value: null): Q;
  eq(column: string, value: number): Q;
}

export function applyFolderFilter<Q extends FilterableQuery<Q>>(query: Q, folder: FolderParam): Q {
  if (folder === "root") return query.is("folder_id", null);
  if (typeof folder === "number") return query.eq("folder_id", folder);
  return query;
}
