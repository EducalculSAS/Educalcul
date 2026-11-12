import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { runExerciseGeneration, type ExerciseGenerationParams } from "@/lib/exerciseGeneration";
import { normFolderName as norm } from "@/lib/folderNames";

/**
 * File serveur de la génération d'exercices par lots. Chaque exercice est une ligne `content_generations` au statut
 * « queued » (params.batchId). Chaque minute, pg_cron appelle /api/cron/exercise-queue-advance (seulement s'il reste
 * du travail) qui démarre les générations manquantes en parallèle (`pumpQueue`). Tout se passe sur le serveur : fermer
 * l'onglet n'arrête rien, et aucune fonction ne s'appelle elle-même.
 */

export const MAX_BATCH_ATTEMPTS = 2;
/** Nouveaux essais d'un exercice en échec, placés en fin de file. */
export const MAX_RETRIES = 2;
const STALE_MINUTES = 6;

export type BatchParams = ExerciseGenerationParams & { batchId: string; courseTitle?: string; styleLabel?: string; attempts?: number; concurrency?: number; retries?: number; lastError?: string | null };

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
    const retries = (params.retries ?? 0) + 1;
    const now = new Date().toISOString();
    // Interrompue deux fois au même endroit : on la remet en fin de file (nouvel essai), sinon on la reprend tout de suite.
    const update =
      attempts < MAX_BATCH_ATTEMPTS
        ? { status: "queued", params: { ...params, attempts }, updated_at: now }
        : retries <= MAX_RETRIES
          ? { status: "queued", created_at: now, updated_at: now, params: { ...params, attempts: 0, retries, lastError: "Génération interrompue (délai maximal du serveur)." } }
          : { status: "error", error: "Génération interrompue à chaque essai (délai maximal du serveur).", updated_at: now };
    await supabaseAdmin
      .from("content_generations")
      .update(update)
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

  // Échec : l'exercice repart EN FIN DE FILE (created_at remis à maintenant), au plus MAX_RETRIES fois, avec un format
  // de plus en plus sûr (formats interactifs → QCM, puis réponse rédigée). Il n'est abandonné qu'après le dernier essai.
  const { data: outcome } = await supabaseAdmin.from("content_generations").select("status, error").eq("id", item.id).maybeSingle();
  if (outcome?.status === "error") {
    const retries = (item.params.retries ?? 0) + 1;
    if (retries <= MAX_RETRIES) {
      const blockType = item.params.blockType ?? "standard";
      const saferType = retries >= 2 || blockType === "qcm" || blockType === "standard" ? "standard" : "qcm";
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("content_generations")
        .update({
          status: "queued",
          error: null,
          created_at: now,
          updated_at: now,
          params: { ...item.params, retries, attempts: 0, blockType: saferType, lastError: outcome.error },
          progress: { step: "outline", current: 0, total: 1, message: `Nouvel essai ${retries}/${MAX_RETRIES} en fin de file` },
        })
        .eq("id", item.id);
    }
  }
  return true;
}

/**
 * Traite des exercices de la file pendant au plus `budgetMs` (une génération dure 1 à 3 min) : moins de relances
 * HTTP en chaîne, donc moins de risques qu'une chaîne s'arrête. Renvoie true s'il reste du travail.
 */
export async function processForAWhile(budgetMs = 90_000): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < budgetMs) {
    const worked = await processNextQueuedExercise();
    if (!worked) return false;
  }
  return true;
}

/**
 * Démarre, dans la fonction en cours (after()), autant de boucles de génération qu'il en manque pour atteindre le
 * parallélisme demandé par le lot le plus ancien encore en attente. Chaque boucle enchaîne des exercices pendant
 * ~60 s puis s'arrête : l'horloge pg_cron (chaque minute) prend le relais. Renvoie le nombre de boucles lancées.
 */
export async function pumpQueue(): Promise<number> {
  // Générations tuées en route (délai maximal) : remises en file avant de compter le travail restant.
  await recoverStale();
  const freshCutoff = new Date(Date.now() - 6 * 60_000).toISOString();
  const [{ data: oldest }, { count: running }] = await Promise.all([
    supabaseAdmin
      .from("content_generations")
      .select("params")
      .eq("kind", "exercise")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("content_generations")
      .select("id", { count: "exact", head: true })
      .eq("kind", "exercise")
      .in("status", ["pending", "running"])
      .not("params->>batchId", "is", null)
      .gt("updated_at", freshCutoff),
  ]);
  if (!oldest) return 0;
  const wanted = Math.min(6, Math.max(1, Number((oldest.params as BatchParams).concurrency) || 4));
  const missing = Math.max(0, wanted - (running ?? 0));
  if (missing === 0) return 0;
  after(async () => {
    await Promise.all(
      Array.from({ length: missing }, (_, i) =>
        new Promise((r) => setTimeout(r, i * 2_000)).then(() =>
          processForAWhile(60_000).catch((err) => console.error("[exercise-batch] boucle interrompue:", err)),
        ),
      ),
    );
  });
  return missing;
}
