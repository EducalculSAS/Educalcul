import { supabaseAdmin } from "@/lib/supabaseClient";

/**
 * Logique commune aux dossiers de contenu admin (cours / exercices / quiz).
 * Les 3 tables partagent la même forme utile — une seule API générique
 * (`/api/admin/content-folders/[type]`) au lieu de 3 jeux de routes quasi
 * identiques, et plus aucune écriture `supabase.from("*_folders")` côté client.
 */

export const FOLDER_TABLES = {
  course: "course_folders",
  exercise: "exercise_folders",
  quiz: "quiz_folders",
} as const;

export type FolderType = keyof typeof FOLDER_TABLES;

export function folderTable(type: string): string | null {
  return (FOLDER_TABLES as Record<string, string>)[type] ?? null;
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
