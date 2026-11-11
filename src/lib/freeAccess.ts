import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getLiveSubscription } from "@/lib/subscriptionLive";
import { resolveLevelScope, type CatalogFolder } from "@/lib/childCatalog";
import { loadPublishedCatalog, loadPublishedFolders } from "@/lib/childCatalogLoaders";
import { rowGuard } from "@/lib/validate";
import { visibleLevels } from "@/lib/specialties";

/**
 * Formule gratuite (Découverte) : l'élève n'a accès qu'au PREMIER CHAPITRE de son niveau. Tout le reste est verrouillé
 * ICI, côté serveur : le contenu d'un cours verrouillé (et des exercices et quiz qui en dépendent) n'est jamais envoyé
 * au navigateur. Aucune manipulation de la page (outils de développement, adresse tapée à la main, appel direct) ne
 * peut donc l'afficher : il n'y a rien à dévoiler côté client.
 *
 * « Premier chapitre » = le dossier du cours publié de plus petit `chapter_order` dans le niveau de l'élève (les
 * cours sont rangés par dossiers de chapitre sous le dossier du niveau). Un cours sans dossier compte pour lui seul.
 * Les parents et les admins ne sont pas concernés, ni les comptes dont la formule est payante.
 */

interface FreeUser { id: number; authId: string; role: string; parentId?: number | null }
type CourseRef = { id: string | number; folder_id: number | null; chapter_order?: number | null };

const isFolder = rowGuard<CatalogFolder>({ id: "number", name: "string" });
const isCourseRef = rowGuard<CourseRef>({ id: "id" });

/** Le compte (ou son parent, pour un élève) a-t-il une formule payante en cours ? */
export async function hasPaidPlan(user: FreeUser): Promise<boolean> {
  let authId = user.authId;
  if (user.role === "child") {
    let parentId = user.parentId;
    if (parentId === undefined) {
      const { data } = await supabaseAdmin.from("users").select("parent_id").eq("id", user.id).maybeSingle();
      parentId = data?.parent_id ?? null;
    }
    if (parentId) {
      const { data: parent } = await supabaseAdmin.from("users").select("auth_id").eq("id", parentId).maybeSingle();
      if (parent?.auth_id) authId = parent.auth_id;
    }
  }
  const sub = await getLiveSubscription(authId);
  if (!sub?.plan_id) return false;
  const { data: plan } = await supabaseAdmin.from("subscription_plans").select("price").eq("id", Number(sub.plan_id)).maybeSingle();
  return Number(plan?.price) > 0;
}

/**
 * Cours ouverts à cet élève en formule gratuite. `null` : aucune restriction (formule payante, parent, admin).
 * Sinon l'ensemble des identifiants de cours du premier chapitre de chacun de ses niveaux.
 */
export async function freeCourseIds(user: FreeUser): Promise<Set<string> | null> {
  if (user.role !== "child") return null;
  if (await hasPaidPlan(user)) return null;

  const [{ data: u }, folders] = await Promise.all([
    supabaseAdmin.from("users").select("grade_level, extra_levels").eq("id", user.id).maybeSingle(),
    loadPublishedFolders("course_folders", "id, parent_id, name, grade_level", isFolder),
  ]);
  const scope = resolveLevelScope(folders, visibleLevels(u?.grade_level, u?.extra_levels));
  const courses = await loadPublishedCatalog("courses", "id, folder_id, chapter_order", { folderIds: scope.folderIds }, isCourseRef);

  // À quel niveau (dossier racine) appartient chaque dossier.
  const parentOf = new Map(folders.map((f) => [f.id, f.parent_id ?? null]));
  const roots = new Set(scope.rootFolderIds ?? (scope.levelFolderId != null ? [scope.levelFolderId] : []));
  const rootOf = (folderId: number | null): number | null => {
    let cur = folderId;
    for (let i = 0; cur != null && i < 20; i++) {
      if (roots.has(cur)) return cur;
      cur = parentOf.get(cur) ?? null;
    }
    return null;
  };

  // Par niveau : le cours de plus petit ordre désigne le premier chapitre.
  const order = (c: CourseRef) => (typeof c.chapter_order === "number" ? c.chapter_order : Number.MAX_SAFE_INTEGER);
  const firstByRoot = new Map<number | null, CourseRef>();
  for (const c of courses) {
    const root = rootOf(c.folder_id);
    const best = firstByRoot.get(root);
    if (!best || order(c) < order(best) || (order(c) === order(best) && String(c.id) < String(best.id))) firstByRoot.set(root, c);
  }
  const open = new Set<string>();
  for (const first of firstByRoot.values()) {
    if (first.folder_id == null) { open.add(String(first.id)); continue; }
    for (const c of courses) if (c.folder_id === first.folder_id) open.add(String(c.id));
  }
  return open;
}

/** Ce cours est-il ouvert à cet élève ? (toujours vrai hors formule gratuite) */
export async function mayOpenCourse(user: FreeUser, courseId: string | number | null | undefined): Promise<boolean> {
  const open = await freeCourseIds(user);
  if (!open) return true;
  return courseId != null && open.has(String(courseId));
}
