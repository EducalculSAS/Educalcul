import { supabaseAdmin } from "@/lib/supabaseClient";
import { selectAllPages } from "@/lib/selectAllPages";

/**
 * Chargement des catalogues élève (cours, exercices, quiz).
 *
 * Deux défauts corrigés ici, communs aux trois pages :
 *
 * 1. PAS DE PAGINATION. Le contenu publié était lu d'un simple `.select()`,
 *    que PostgREST plafonne SILENCIEUSEMENT à 1000 lignes. Invisible tant que
 *    tout est en brouillon, mais le jour où les 7 560 exercices seront
 *    publiés, 6 560 auraient manqué — la plupart des dossiers seraient
 *    apparus vides aux élèves.
 *
 * 2. TOUT LE CATALOGUE, TOUS NIVEAUX, À CHAQUE VISITE. Un élève ne navigue
 *    que dans le dossier de SON niveau : on ne charge plus que ce
 *    sous-arbre (≈ 1/16 du contenu).
 */

export interface CatalogFolder {
  id: number;
  parent_id: number | null;
  name: string;
  grade_level?: string;
}

function normalizeLevelKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/** Dossier racine correspondant au niveau de l'élève. */
export function findLevelFolder<F extends CatalogFolder>(folders: F[], level: string | null): F | undefined {
  const lvl = normalizeLevelKey(String(level || ""));
  if (!lvl) return undefined;
  return folders.find(
    (f) =>
      f.parent_id == null &&
      (normalizeLevelKey(String(f.grade_level || "")) === lvl || normalizeLevelKey(String(f.name || "")) === lvl),
  );
}

/**
 * Périmètre du catalogue d'un élève à partir de ses niveaux visibles (classe
 * principale + niveaux en plus, voir specialties.ts). Un seul niveau : on
 * ouvre directement son dossier. Plusieurs (ex. spé maths + maths expertes) :
 * la racine du catalogue montre un dossier par niveau.
 */
export function resolveLevelScope<F extends CatalogFolder>(folders: F[], levels: string[]) {
  const roots: F[] = [];
  for (const level of levels) {
    const f = findLevelFolder(folders, level);
    if (f && !roots.some((r) => r.id === f.id)) roots.push(f);
  }
  if (roots.length === 0) return { levelFolderId: null, rootFolderIds: null, folderIds: null };
  const folderIds = [...new Set(roots.flatMap((r) => subtreeIds(folders, r.id)))];
  return roots.length === 1
    ? { levelFolderId: roots[0].id, rootFolderIds: null, folderIds }
    : { levelFolderId: null, rootFolderIds: roots.map((r) => r.id), folderIds };
}

/** Ids du dossier et de tous ses descendants (parcours en largeur, sans
 * récursion : protégé contre un éventuel cycle en base). */
export function subtreeIds(folders: CatalogFolder[], rootId: number): number[] {
  const children = new Map<number, number[]>();
  for (const f of folders) {
    if (f.parent_id == null) continue;
    const list = children.get(f.parent_id) ?? [];
    list.push(f.id);
    children.set(f.parent_id, list);
  }
  const seen = new Set<number>([rootId]);
  const queue = [rootId];
  while (queue.length) {
    for (const child of children.get(queue.shift()!) ?? []) {
      if (!seen.has(child)) {
        seen.add(child);
        queue.push(child);
      }
    }
  }
  return [...seen];
}

/** Vérifie qu'un dossier mémorisé appartient encore au périmètre visible. */
export function isFolderInLevelScope<F extends CatalogFolder>(
  folders: F[],
  folderId: number,
  scope: { levelFolderId: number | null; rootFolderIds: number[] | null },
): boolean {
  const rootIds = scope.rootFolderIds ?? (scope.levelFolderId === null ? [] : [scope.levelFolderId]);
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const seen = new Set<number>();
  let current = byId.get(folderId);
  while (current && !seen.has(current.id)) {
    if (rootIds.includes(current.id)) return true;
    seen.add(current.id);
    current = current.parent_id === null ? undefined : byId.get(current.parent_id);
  }
  return false;
}

type CatalogTable = "courses" | "exercises" | "quizzes";

/**
 * Éléments PUBLIÉS d'un catalogue, paginés.
 *  - `courseId` : uniquement ce cours (bouton « Faire les exercices » en fin
 *    de cours) — prioritaire, quel que soit le niveau du cours ;
 *  - `folderIds` : uniquement ces dossiers (le sous-arbre du niveau) ;
 *  - ni l'un ni l'autre : tout le catalogue publié (élève sans niveau).
 */
export async function loadPublishedCatalog<T>(
  table: CatalogTable,
  columns: string,
  scope: { courseId?: string | null; folderIds?: number[] | null },
): Promise<T[]> {
  return selectAllPages<T>((from, to) => {
    // Tri par id : sans ordre fixe, la pagination (par 1000) pouvait sauter ou doubler des lignes.
    let q = supabaseAdmin.from(table).select(columns).eq("status", "published").order("id").range(from, to);
    if (scope.courseId) q = q.eq("course_id", scope.courseId);
    else if (scope.folderIds) q = q.in("folder_id", scope.folderIds);
    return q as unknown as PromiseLike<{ data: T[] | null; error: unknown }>;
  });
}

/** Tous les dossiers publiés d'un type, paginés. */
export async function loadPublishedFolders<F>(
  table: "course_folders" | "exercise_folders" | "quiz_folders",
  columns: string,
  opts: { byDisplayOrder?: boolean } = {},
): Promise<F[]> {
  return selectAllPages<F>((from, to) => {
    let q = supabaseAdmin.from(table).select(columns).eq("status", "published");
    if (opts.byDisplayOrder) q = q.order("display_order");
    return q.order("name").range(from, to) as unknown as PromiseLike<{ data: F[] | null; error: unknown }>;
  });
}
