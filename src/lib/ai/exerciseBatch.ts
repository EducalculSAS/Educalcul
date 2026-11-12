import { supabaseAdmin } from "@/lib/supabaseClient";
import { runExerciseGeneration, type ExerciseGenerationParams } from "@/lib/exerciseGeneration";
import { normFolderName as norm } from "@/lib/folderNames";

/**
 * File serveur de la génération d'exercices par lots. Chaque exercice est une ligne `content_generations` au statut
 * « queued » (params.batchId). Plusieurs chaînes tournent en parallèle : chaque appel de
 * /api/cron/exercise-queue-advance prend UN exercice, le génère, puis se rappelle lui-même pour le suivant, jusqu'à ce
 * que la file soit vide. Tout se passe sur le serveur : fermer l'onglet n'arrête rien.
 */

export const MAX_BATCH_ATTEMPTS = 2;
const STALE_MINUTES = 6;

export type BatchParams = ExerciseGenerationParams & { batchId: string; courseTitle?: string; styleLabel?: string; attempts?: number };

interface FolderRow { id: number; name: string; parent_id: number | null; grade_level: string | null }

/**
 * Dossier d'exercices d'un cours : le sous-dossier qui porte le nom du cours, créé dans le dossier de domaine
 * correspondant (« Espace et géométrie »…) s'il n'existe pas encore. Repli : le dossier de domaine, puis la racine.
 */
export async function resolveCourseExerciseFolders(level: string, courses: { id: number; title: string; folder_id: number | null }[]): Promise<Map<number, number | null>> {
  const out = new Map<number, number | null>();
  const [{ data: exFolders }, { data: courseFolders }] = await Promise.all([
    supabaseAdmin.from("exercise_folders").select("id, name, parent_id, grade_level").eq("grade_level", level),
    supabaseAdmin.from("course_folders").select("id, name, parent_id, grade_level").eq("grade_level", level),
  ]);
  const ex = [...((exFolders as FolderRow[]) ?? [])];
  const root = ex.find((f) => f.parent_id === null) ?? null;
  for (const course of courses) {
    const own = ex.find((f) => norm(f.name) === norm(course.title));
    if (own) { out.set(course.id, own.id); continue; }
    const domainName = ((courseFolders as FolderRow[]) ?? []).find((f) => f.id === course.folder_id)?.name;
    const domain = domainName ? ex.find((f) => norm(f.name) === norm(domainName)) : undefined;
    const parent = domain ?? root;
    if (!parent) { out.set(course.id, null); continue; }
    const { data: created } = await supabaseAdmin
      .from("exercise_folders")
      .insert({ name: course.title, parent_id: parent.id, grade_level: level, status: "published", display_order: 100 })
      .select("id, name, parent_id, grade_level")
      .single();
    if (created) { ex.push(created as FolderRow); out.set(course.id, (created as FolderRow).id); }
    else out.set(course.id, parent.id);
  }
  return out;
}

export function queueUrl(origin: string) {
  return `${process.env.NEXT_PUBLIC_SITE_URL || origin}/api/cron/exercise-queue-advance`;
}

/** Démarre (ou relance) `count` chaînes de traitement. */
export async function kickChains(origin: string, count: number) {
  const url = queueUrl(origin);
  await Promise.all(
    Array.from({ length: count }, (_, i) =>
      new Promise((r) => setTimeout(r, i * 1_500)).then(() =>
        fetch(url, { method: "POST", headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } }).catch((err) =>
          console.error("[exercise-batch] relance impossible:", err),
        ),
      ),
    ),
  );
}

/** Une génération morte (fonction tuée) est remise en file, ou abandonnée après MAX_BATCH_ATTEMPTS. */
async function recoverStale() {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
  const { data } = await supabaseAdmin
    .from("content_generations")
    .select("id, params")
    .eq("kind", "exercise")
    .in("status", ["pending", "running"])
    .not("params->>batchId", "is", null)
    .lt("updated_at", cutoff);
  for (const row of data ?? []) {
    const params = row.params as BatchParams;
    const attempts = (params.attempts ?? 0) + 1;
    await supabaseAdmin
      .from("content_generations")
      .update(
        attempts >= MAX_BATCH_ATTEMPTS
          ? { status: "error", error: "Génération interrompue deux fois (délai maximal du serveur).", updated_at: new Date().toISOString() }
          : { status: "queued", params: { ...params, attempts }, updated_at: new Date().toISOString() },
      )
      .eq("id", row.id);
  }
}

async function claimNext(): Promise<{ id: string; admin_id: number; params: BatchParams } | null> {
  await recoverStale();
  for (let tries = 0; tries < 5; tries++) {
    const { data: candidate } = await supabaseAdmin
      .from("content_generations")
      .select("id")
      .eq("kind", "exercise")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!candidate) return null;
    // Prise atomique : une seule chaîne obtient la ligne (les autres voient le statut déjà changé).
    const { data: claimed } = await supabaseAdmin
      .from("content_generations")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("id", candidate.id)
      .eq("status", "queued")
      .select("id, admin_id, params")
      .maybeSingle();
    if (claimed) return claimed as { id: string; admin_id: number; params: BatchParams };
  }
  return null;
}

/** Traite un exercice de la file. Renvoie false quand la file est vide. */
export async function processNextQueuedExercise(): Promise<boolean> {
  const item = await claimNext();
  if (!item) return false;
  await runExerciseGeneration(item.id, item.params, item.admin_id);

  // Les formats interactifs (association, mise en ordre, texte à trous) échouent parfois : l'exercice repart une fois
  // en QCM plutôt que d'être perdu.
  const { data: after } = await supabaseAdmin.from("content_generations").select("status, error").eq("id", item.id).maybeSingle();
  const blockType = item.params.blockType ?? "standard";
  if (after?.status === "error" && /aucune question/.test(after.error ?? "") && !["standard", "qcm"].includes(blockType)) {
    await supabaseAdmin
      .from("content_generations")
      .update({ status: "queued", error: null, params: { ...item.params, blockType: "qcm" }, updated_at: new Date().toISOString() })
      .eq("id", item.id);
  }
  return true;
}
