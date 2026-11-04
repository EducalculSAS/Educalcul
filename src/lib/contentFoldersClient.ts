import { z } from "zod";
import { parseList } from "@/lib/validate";
/**
 * Client des dossiers de contenu admin (cours / exercices / quiz) via
 * `/api/admin/content-folders/[type]`. Remplace les `supabase.from("*_folders")`
 * éparpillés dans AdminCoursesClient / AdminExercisesClient / AdminQuizzesClient.
 */

export interface ContentFolder {
  id: number;
  name: string;
  parent_id: number | null;
  status: "published" | "draft" | "archived";
  color: string | null;
  icon: string | null;
  grade_level: string | null;
  display_order: number | null;
  is_system: boolean | null;
  /** Nombre d'éléments (cours / exercices / quiz) rangés DIRECTEMENT dans ce
   * dossier, agrégé côté base par la route de liste. */
  item_count?: number;
}

/** Dossier tel que renvoyé par la route de liste. Le statut inconnu devient « draft » (jamais montré aux élèves) ; couleur, icône et niveau peuvent être vides. */
const folderSchema = z.looseObject({
  id: z.number(),
  name: z.string(),
  parent_id: z.number().nullable().default(null),
  status: z.enum(["published", "draft", "archived"]).catch("draft"),
  color: z.string().nullable().default(null),
  icon: z.string().nullable().default(null),
  grade_level: z.string().nullable().default(null),
  display_order: z.number().nullable().default(null),
  is_system: z.boolean().nullable().default(null),
  item_count: z.number().optional(),
});

export type ContentFolderType = "course" | "exercise" | "quiz";

const base = (type: ContentFolderType) => `/api/admin/content-folders/${type}`;

/** Liste PLATE de tous les dossiers du type. Le composant filtre par parent,
 * construit le fil d'Ariane et détecte les cycles à partir de cette liste. */
export async function listFolders(type: ContentFolderType): Promise<ContentFolder[]> {
  const res = await fetch(base(type));
  if (!res.ok) return [];
  return parseList(folderSchema, await res.json(), "dossiers");
}

export async function createFolder(
  type: ContentFolderType,
  fields: Partial<ContentFolder>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(base(type), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (res.ok) return { ok: true };
  return { ok: false, error: (await res.json().catch(() => ({}))).error };
}

export async function updateFolder(
  type: ContentFolderType,
  id: number,
  fields: Partial<ContentFolder>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${base(type)}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (res.ok) return { ok: true };
  return { ok: false, error: (await res.json().catch(() => ({}))).error };
}

export async function deleteFolder(
  type: ContentFolderType,
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${base(type)}/${id}`, { method: "DELETE" });
  if (res.ok) return { ok: true };
  return { ok: false, error: (await res.json().catch(() => ({}))).error };
}

/** Cycle-check local à partir de la liste plate (le serveur revérifie). */
export function isSelfOrDescendant(
  folders: ContentFolder[],
  folderId: number,
  candidateParentId: number | null,
): boolean {
  let currentId = candidateParentId;
  let guard = 0;
  while (currentId !== null && guard < 100) {
    if (currentId === folderId) return true;
    currentId = folders.find((f) => f.id === currentId)?.parent_id ?? null;
    guard++;
  }
  return false;
}

/** Fil d'Ariane (racine → dossier) à partir de la liste plate. */
export function buildBreadcrumbs(folders: ContentFolder[], folderId: number): ContentFolder[] {
  const path: ContentFolder[] = [];
  let currentId: number | null = folderId;
  let guard = 0;
  while (currentId !== null && guard < 100) {
    const f = folders.find((x) => x.id === currentId);
    if (!f) break;
    path.unshift(f);
    currentId = f.parent_id;
    guard++;
  }
  return path;
}

/** Enregistre l'ordre de dossiers frères (liste d'identifiants dans l'ordre voulu). */
export async function reorderFolders(type: ContentFolderType, orderedIds: number[]): Promise<boolean> {
  const res = await fetch(`${base(type)}/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderedIds }),
  });
  return res.ok;
}
