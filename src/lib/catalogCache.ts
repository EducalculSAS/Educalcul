import { revalidateTag } from "next/cache";

/** Tag commun de tous les catalogues élèves mis en cache (cours, exercices, quiz et leurs dossiers) : voir childCatalog.ts. */
export const CATALOG_TAG = "catalog";

/**
 * À appeler APRÈS une écriture réussie qui peut changer ce qu'un élève voit : publication, dépublication, création,
 * suppression, déplacement, réordonnancement, renommage. `expire: 0` : la lecture suivante ne reçoit jamais l'ancienne
 * entrée (une dépublication ne doit pas rester visible). Filet de sécurité : le cache expire de toute façon après 60 s.
 */
export function invalidateCatalog(): void {
  revalidateTag(CATALOG_TAG, { expire: 0 });
}
