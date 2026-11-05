/**
 * Tâches planifiées groupées. L'offre gratuite de Vercel n'autorise que 2 tâches planifiées, une fois par jour au plus :
 * deux « répartiteurs » (matin et soir, voir vercel.json) enchaînent donc les tâches quotidiennes, qui gardent chacune
 * leur route (appelable seule, même contrôle CRON_SECRET) et leur propre logique.
 */
export interface CronJob {
  name: string;
  run: (req: Request) => Promise<Response>;
}

export interface CronJobReport {
  name: string;
  status: number | "erreur" | "reporté";
  detail?: unknown;
}

/** Au-delà de ce délai, on ne démarre plus de nouvelle tâche (la limite de la fonction est de 300 s) : elle passera le lendemain. */
export const START_DEADLINE_MS = 200_000;

export async function runCronJobs(
  req: Request,
  jobs: CronJob[],
  { now = () => Date.now(), deadlineMs = START_DEADLINE_MS }: { now?: () => number; deadlineMs?: number } = {},
): Promise<Response> {
  if (!process.env.CRON_SECRET) return Response.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const start = now();
  const reports: CronJobReport[] = [];
  for (const job of jobs) {
    if (now() - start > deadlineMs) {
      reports.push({ name: job.name, status: "reporté" });
      continue;
    }
    try {
      const res = await job.run(req);
      const detail = await res.json().catch(() => undefined);
      reports.push({ name: job.name, status: res.status, detail });
    } catch (err) {
      console.error(`[cron:${job.name}]`, err instanceof Error ? err.message : err);
      reports.push({ name: job.name, status: "erreur", detail: err instanceof Error ? err.message : String(err) });
    }
  }
  const failed = reports.some((r) => r.status === "erreur" || (typeof r.status === "number" && r.status >= 400));
  return Response.json({ ok: !failed, jobs: reports }, { status: failed ? 207 : 200 });
}
