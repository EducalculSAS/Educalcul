import { supabaseAdmin } from "@/lib/supabaseClient";
import type { ContentFolder } from "@/lib/contentFoldersClient";
import { invalidateCatalog } from "@/lib/catalogCache";

/**
 * Logique commune aux dossiers de contenu admin (cours / exercices / quiz).
 * Les 3 tables partagent la même forme utile — une seule API générique
 * (`/api/admin/content-folders/[type]`) au lieu de 3 jeux de routes quasi
 * identiques, et plus aucune écriture `supabase.from("*_folders")` côté client.
 */

const FOLDER_TABLES = {
  course: "course_folders",
  exercise: "exercise_folders",
  quiz: "quiz_folders",
} as const;

export type FolderType = keyof typeof FOLDER_TABLES;

export function folderTable(type: string): string | null {
  return (FOLDER_TABLES as Record<string, string>)[type] ?? null;
}

const FOLDER_LIST_COLUMNS =
  "id, name, parent_id, status, color, icon, grade_level, display_order, is_system";

/**
 * Liste PLATE de tous les dossiers d'un type, chacun avec le nombre
 * d'éléments rangés directement dedans (`item_count`, agrégé en base par
 * admin_item_counts_by_folder). Partagée par la route de liste et par le
 * chargement initial des pages admin : une seule définition de « ce qu'un
 * dossier affiche ».
 *
 * Paginée : PostgREST plafonne un select à 1000 lignes, et les tables de
 * dossiers en comptent déjà ~770 (un sous-dossier par cours).
 */
export async function loadFoldersWithCounts(type: FolderType) {
  const table = FOLDER_TABLES[type];
  const pageSize = 1000;
  const loadFolders = async () => {
    const rows: Omit<ContentFolder, "item_count">[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select(FOLDER_LIST_COLUMNS)
        .order("display_order", { ascending: true })
        .order("name", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      rows.push(...((data ?? []) as unknown as Omit<ContentFolder, "item_count">[]));
      if (!data || data.length < pageSize) break;
    }
    return rows;
  };

  const [folders, counts] = await Promise.all([
    loadFolders(),
    // Un seul objet { dossier: nombre } : une fonction qui renvoie des LIGNES
    // serait plafonnée à 1000 dossiers par PostgREST.
    supabaseAdmin.rpc("admin_item_counts_by_folder_json", { p_kind: type }),
  ]);
  if (counts.error) throw counts.error;

  const itemsByFolder = new Map<number, number>(
    Object.entries((counts.data ?? {}) as Record<string, number>).map(([id, n]) => [Number(id), Number(n)]),
  );
  return folders.map((folder) => ({ ...folder, item_count: itemsByFolder.get(folder.id) ?? 0 }));
}

/** Colonnes qu'un admin peut écrire (les mêmes pour les 3 tables). */
const WRITABLE = ["name", "parent_id", "status", "color", "icon", "grade_level"] as const;

export function pickFolderFields(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of WRITABLE) {
    if (k in body) out[k] = body[k];
  }
  return out;
}

/**
 * Vrai si `candidateParentId` est le dossier `folderId` lui-même ou l'un de ses
 * descendants — sert à refuser un déplacement qui créerait un cycle. Fait côté
 * serveur (avant : boucle de requêtes depuis le navigateur).
 */
export async function isSelfOrDescendant(
  table: string,
  folderId: number,
  candidateParentId: number | null,
): Promise<boolean> {
  let currentId: number | null = candidateParentId;
  let guard = 0;
  while (currentId !== null && guard < 100) {
    if (currentId === folderId) return true;
    const { data } = await supabaseAdmin
      .from(table)
      .select("parent_id")
      .eq("id", currentId)
      .maybeSingle();
    currentId = (data?.parent_id as number | null) ?? null;
    guard++;
  }
  return false;
}

/**
 * Enregistre l'ordre de dossiers frères (même dossier parent), tel que l'admin l'a arrangé :
 * display_order = (rang + 1) × 10. L'élève voit les dossiers dans cet ordre (display_order, puis nom).
 */
export async function reorderFolders(table: string, ids: unknown): Promise<{ error: string; status: number } | { ok: true; count: number }> {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) return { error: "orderedIds invalide", status: 400 };
  const clean = ids.map(String);
  if (clean.some((id) => !/^\d{1,12}$/.test(id)) || new Set(clean).size !== clean.length) {
    return { error: "orderedIds invalide", status: 400 };
  }
  const { data: rows, error } = await supabaseAdmin.from(table).select("id, parent_id").in("id", clean);
  if (error) throw error;
  if (!rows || rows.length !== clean.length) return { error: "Dossier introuvable", status: 404 };
  if (new Set(rows.map((r) => r.parent_id ?? "root")).size > 1) {
    return { error: "Les dossiers doivent avoir le même dossier parent", status: 400 };
  }
  const results = await Promise.all(clean.map((id, i) => supabaseAdmin.from(table).update({ display_order: (i + 1) * 10 }).eq("id", id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
  invalidateCatalog();
  return { ok: true, count: clean.length };
}
