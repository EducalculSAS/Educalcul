import { supabaseAdmin } from "@/lib/supabaseClient";
import { loadPublishedFolders, resolveLevelScope, type CatalogFolder } from "@/lib/childCatalog";
import { visibleLevels } from "@/lib/specialties";

type FolderTable = "course_folders" | "exercise_folders" | "quiz_folders";

const normalize = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

/**
 * Un élève ne peut ouvrir (par adresse directe) que le contenu de ses niveaux : sa classe et les niveaux en plus
 * (spécialités, maths expertes, niveaux attribués par l'admin). Le catalogue le filtrait déjà, pas l'adresse.
 *
 * Autorisé si l'un des cas suivant tient (on ne refuse que quand rien ne rattache le contenu à l'élève) :
 *  - le niveau du contenu est l'un des siens ;
 *  - son dossier fait partie des dossiers de ses niveaux (même règle que le catalogue) ;
 *  - il l'a déjà tenté (historique d'une classe précédente après un passage en classe supérieure) ;
 *  - rien ne permet de décider (niveau et dossier absents, dossiers illisibles) : pas de faux refus.
 * Les parents et les admins ne sont pas concernés.
 */
export async function childMayOpen(
  user: { id: number; role: string },
  item: { kind: "course" | "exercise" | "quiz"; id: string | number; level?: string | null; folder_id?: number | null },
  folderTable: FolderTable,
): Promise<boolean> {
  if (user.role !== "child") return true;
  const { data: u } = await supabaseAdmin.from("users").select("grade_level, extra_levels").eq("id", user.id).maybeSingle();
  const levels = visibleLevels(u?.grade_level, u?.extra_levels);
  if (levels.length === 0) return true;

  if (item.level && levels.some((l) => normalize(l) === normalize(item.level!))) return true;

  let decidable = !!item.level;
  if (item.folder_id != null) {
    try {
      const folders = await loadPublishedFolders<CatalogFolder>(folderTable, "id, parent_id, name, grade_level");
      const scope = resolveLevelScope(folders, levels);
      if (!scope.folderIds) return true; // pas de dossier de niveau connu : rien à comparer
      if (scope.folderIds.includes(item.folder_id)) return true;
      decidable = true;
    } catch {
      return true;
    }
  }
  if (!decidable) return true;

  // Déjà tenté : on laisse revoir (changement de classe).
  const attempts = item.kind === "exercise" ? "user_exercise_attempts" : item.kind === "quiz" ? "user_quiz_attempts" : "user_course_progress";
  const col = item.kind === "exercise" ? "exercise_id" : item.kind === "quiz" ? "quiz_id" : "course_id";
  const { data: seen } = await supabaseAdmin.from(attempts).select("user_id").eq("user_id", user.id).eq(col, item.id).limit(1).maybeSingle();
  return !!seen;
}
