import "server-only";
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { selectAllPages } from "@/lib/selectAllPages";
import { CATALOG_TAG } from "@/lib/catalogCache";

// Chargement (et cache serveur partagé) des catalogues élèves. Séparé de childCatalog.ts, dont les fonctions pures sont
// aussi utilisées par des composants client.

type CatalogTable = "courses" | "exercises" | "quizzes";

/**
 * Éléments PUBLIÉS d'un catalogue, paginés.
 *  - `courseId` : uniquement ce cours (bouton « Faire les exercices » en fin
 *    de cours) — prioritaire, quel que soit le niveau du cours ;
 *  - `folderIds` : uniquement ces dossiers (le sous-arbre du niveau) ;
 *  - ni l'un ni l'autre : tout le catalogue publié (élève sans niveau).
 */
async function readCatalog<T>(
  table: CatalogTable,
  columns: string,
  courseId: string | null,
  folderIds: number[] | null,
): Promise<T[]> {
  return selectAllPages<T>((from, to) => {
    // Tri par id : sans ordre fixe, la pagination (par 1000) pouvait sauter ou doubler des lignes.
    let q = supabaseAdmin.from(table).select(columns).eq("status", "published").order("id").range(from, to);
    if (courseId) q = q.eq("course_id", courseId);
    else if (folderIds) q = q.in("folder_id", folderIds);
    return q as unknown as PromiseLike<{ data: T[] | null; error: unknown }>;
  });
}

/**
 * Cache serveur PARTAGÉ des catalogues : le contenu publié d'un niveau est le même pour tous les élèves du niveau, il
 * n'avait aucune raison d'être relu en base à chaque visite. Ne contient rien de personnel (pas de progression, pas de
 * content_json, pas de réponses) et n'utilise aucun cookie. La clé inclut table, colonnes, cours et dossiers.
 * Invalidé à chaque écriture admin (invalidateCatalog, tag « catalog ») ; expire de toute façon après 60 s au cas où une
 * écriture passerait par un autre chemin (import, tâche planifiée). Les droits (niveau, abonnement) sont contrôlés
 * par les pages avant d'afficher quoi que ce soit.
 */
const cachedCatalogReaders = {
  courses: unstable_cache((c: string, cid: string | null, f: number[] | null) => readCatalog<unknown>("courses", c, cid, f), ["catalog-courses"], { revalidate: 60, tags: [CATALOG_TAG] }),
  exercises: unstable_cache((c: string, cid: string | null, f: number[] | null) => readCatalog<unknown>("exercises", c, cid, f), ["catalog-exercises"], { revalidate: 60, tags: [CATALOG_TAG] }),
  quizzes: unstable_cache((c: string, cid: string | null, f: number[] | null) => readCatalog<unknown>("quizzes", c, cid, f), ["catalog-quizzes"], { revalidate: 60, tags: [CATALOG_TAG] }),
};

export async function loadPublishedCatalog<T>(
  table: CatalogTable,
  columns: string,
  scope: { courseId?: string | null; folderIds?: number[] | null },
): Promise<T[]> {
  return (await cachedCatalogReaders[table](columns, scope.courseId ?? null, scope.folderIds ?? null)) as T[];
}

/** Tous les dossiers publiés d'un type, paginés. */
async function readFolders<F>(
  table: "course_folders" | "exercise_folders" | "quiz_folders",
  columns: string,
  byDisplayOrder: boolean,
): Promise<F[]> {
  return selectAllPages<F>((from, to) => {
    let q = supabaseAdmin.from(table).select(columns).eq("status", "published");
    if (byDisplayOrder) q = q.order("display_order");
    return q.order("name").range(from, to) as unknown as PromiseLike<{ data: F[] | null; error: unknown }>;
  });
}

// Même cache partagé et même invalidation que les catalogues (dossiers : identiques pour tous les élèves).
const cachedFolderReaders = {
  course_folders: unstable_cache((c: string, o: boolean) => readFolders<unknown>("course_folders", c, o), ["catalog-course-folders"], { revalidate: 60, tags: [CATALOG_TAG] }),
  exercise_folders: unstable_cache((c: string, o: boolean) => readFolders<unknown>("exercise_folders", c, o), ["catalog-exercise-folders"], { revalidate: 60, tags: [CATALOG_TAG] }),
  quiz_folders: unstable_cache((c: string, o: boolean) => readFolders<unknown>("quiz_folders", c, o), ["catalog-quiz-folders"], { revalidate: 60, tags: [CATALOG_TAG] }),
};

export async function loadPublishedFolders<F>(
  table: "course_folders" | "exercise_folders" | "quiz_folders",
  columns: string,
  opts: { byDisplayOrder?: boolean } = {},
): Promise<F[]> {
  return (await cachedFolderReaders[table](columns, !!opts.byDisplayOrder)) as F[];
}
