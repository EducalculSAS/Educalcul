import { requireRole } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { pumpQueue, resolveCourseExerciseFolders, type BatchParams } from "@/lib/ai/exerciseBatch";
import type { ExerciseGenerationParams } from "@/lib/exerciseGeneration";

export const maxDuration = 300;

interface JobInput extends ExerciseGenerationParams { courseTitle?: string; styleLabel?: string }

/**
 * Lance une génération par lots côté serveur : une ligne « queued » par exercice, traitées `concurrency` à la fois
 * (pumpQueue, puis l'horloge pg_cron chaque minute). Fermer la page n'arrête pas le lot.
 * GET ?batch=<id> : état de chaque exercice. PATCH {batch, action:"resume"|"cancel"}.
 */
export async function POST(request: Request) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.CRON_SECRET) return Response.json({ error: "CRON_SECRET manquant sur le serveur." }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const level = String(body.level || "");
  const jobs: JobInput[] = Array.isArray(body.jobs) ? body.jobs.slice(0, 300) : [];
  const concurrency = Math.min(6, Math.max(1, Number(body.concurrency) || 3));
  if (!level || jobs.length === 0) return Response.json({ error: "Niveau et exercices requis." }, { status: 400 });

  const courseIds = [...new Set(jobs.map((j) => Number(j.linkedCourseId)).filter(Boolean))];
  const { data: courses } = await supabaseAdmin.from("courses").select("id, title, folder_id").in("id", courseIds);
  const folders = await resolveCourseExerciseFolders(level, (courses ?? []) as { id: number; title: string; folder_id: number | null }[]);

  const batchId = crypto.randomUUID();
  const rows = jobs.map((job) => {
    const params: BatchParams = {
      ...job,
      level,
      subjectArea: job.subjectArea || "Mathématiques",
      folder_id: folders.get(Number(job.linkedCourseId)) ?? null,
      batchId,
      concurrency,
      attempts: 0,
    };
    return {
      kind: "exercise",
      admin_id: admin.id,
      status: "queued",
      params,
      progress: { step: "outline", current: 0, total: 1, message: "En file d'attente" },
    };
  });
  const { error } = await supabaseAdmin.from("content_generations").insert(rows);
  if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

  // Démarre tout de suite ; l'horloge pg_cron (chaque minute) prend ensuite le relais.
  await pumpQueue();
  return Response.json({ batchId, count: rows.length }, { status: 202 });
}

export async function GET(request: Request) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  // Résumé du lot le plus récent (pastille de l'admin) : un seul appel léger, sans le détail des exercices.
  if (url.searchParams.get("summary")) {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("content_generations")
      .select("status, updated_at, params->>batchId")
      .eq("kind", "exercise")
      .eq("admin_id", admin.id)
      .not("params->>batchId", "is", null)
      .gt("updated_at", since)
      .limit(2000);
    const byBatch = new Map<string, { total: number; done: number; errors: number; active: number; last: string }>();
    for (const r of (recent ?? []) as { status: string; updated_at: string; batchId: string }[]) {
      const b = byBatch.get(r.batchId) ?? { total: 0, done: 0, errors: 0, active: 0, last: "" };
      b.total += 1;
      if (r.status === "done") b.done += 1;
      else if (r.status === "error") b.errors += 1;
      else if (["queued", "pending", "running"].includes(r.status)) b.active += 1;
      if (r.updated_at > b.last) b.last = r.updated_at;
      byBatch.set(r.batchId, b);
    }
    const latest = [...byBatch.entries()].sort((x, y) => (x[1].last < y[1].last ? 1 : -1))[0];
    return Response.json(latest ? { batchId: latest[0], ...latest[1] } : null);
  }
  const batch = url.searchParams.get("batch");
  if (!batch) return Response.json({ error: "batch requis" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("content_generations")
    .select("id, status, error, target_id, progress, params, created_at, updated_at")
    .eq("kind", "exercise")
    .eq("admin_id", admin.id)
    .eq("params->>batchId", batch)
    .order("created_at", { ascending: true });
  if (error) return Response.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

  return Response.json(
    (data ?? []).map((r) => {
      const p = r.params as BatchParams;
      const progress = (r.progress ?? {}) as { message?: string; warnings?: string[] };
      return {
        id: r.id,
        status: r.status,
        error: r.error,
        exerciseId: r.target_id,
        message: progress.message ?? "",
        warnings: progress.warnings ?? [],
        courseTitle: p.courseTitle ?? p.subject,
        styleLabel: p.styleLabel ?? "",
        blockType: p.blockType,
        updatedAt: r.updated_at,
      };
    }),
  );
}

export async function PATCH(request: Request) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const batch = String(body.batch || "");
  if (!batch) return Response.json({ error: "batch requis" }, { status: 400 });
  if (body.action === "cancel") {
    await supabaseAdmin
      .from("content_generations")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("kind", "exercise")
      .eq("admin_id", admin.id)
      .eq("status", "queued")
      .eq("params->>batchId", batch);
    return Response.json({ ok: true });
  }
  // Reprise : les exercices en erreur repartent en file, puis les chaînes sont relancées.
  if (body.retryErrors) {
    await supabaseAdmin
      .from("content_generations")
      .update({ status: "queued", error: null, updated_at: new Date().toISOString() })
      .eq("kind", "exercise")
      .eq("admin_id", admin.id)
      .eq("status", "error")
      .eq("params->>batchId", batch);
  }
  await pumpQueue();
  return Response.json({ ok: true });
}
