import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCronJobs } from "@/lib/cronDispatch";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import vercel from "../../../vercel.json";

const sources = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(f) ? [p] : []; });

const req = (auth?: string) => new Request("http://localhost/api/cron/daily-morning", { headers: auth ? { authorization: auth } : {} });
const ok = (name: string, log: string[]) => ({ name, run: async () => { log.push(name); return Response.json({ done: name }); } });

beforeEach(() => { process.env.CRON_SECRET = "s3cret"; });
afterEach(() => { delete process.env.CRON_SECRET; });

describe("tâches quotidiennes groupées", () => {
  it("refuse sans secret ou avec un mauvais secret, sans rien lancer", async () => {
    const log: string[] = [];
    expect((await runCronJobs(req(), [ok("a", log)])).status).toBe(401);
    expect((await runCronJobs(req("Bearer nope"), [ok("a", log)])).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await runCronJobs(req("Bearer undefined"), [ok("a", log)])).status).toBe(500);
    expect(log).toEqual([]);
  });

  it("enchaîne les tâches dans l'ordre et rend le compte rendu de chacune", async () => {
    const log: string[] = [];
    const res = await runCronJobs(req("Bearer s3cret"), [ok("a", log), ok("b", log)]);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(log).toEqual(["a", "b"]);
    expect(body.jobs).toEqual([{ name: "a", status: 200, detail: { done: "a" } }, { name: "b", status: 200, detail: { done: "b" } }]);
  });

  it("une tâche qui échoue n'empêche pas les suivantes", async () => {
    const log: string[] = [];
    const boom = { name: "boom", run: async () => { throw new Error("panne"); } };
    const res = await runCronJobs(req("Bearer s3cret"), [boom, ok("b", log)]);
    const body = await res.json();
    expect(res.status).toBe(207);
    expect(body.ok).toBe(false);
    expect(body.jobs.map((j: { status: unknown }) => j.status)).toEqual(["erreur", 200]);
    expect(log).toEqual(["b"]);
  });

  it("ne démarre plus de tâche passé le délai (elle passera le lendemain)", async () => {
    const log: string[] = [];
    let t = 0;
    const slow = { name: "lente", run: async () => { t += 250_000; log.push("lente"); return Response.json({}); } };
    const res = await runCronJobs(req("Bearer s3cret"), [slow, ok("suivante", log)], { now: () => t });
    const body = await res.json();
    expect(log).toEqual(["lente"]);
    expect(body.jobs[1]).toEqual({ name: "suivante", status: "reporté" });
  });
});

describe("configuration Vercel compatible avec l'offre gratuite", () => {
  it("au plus 2 tâches planifiées, une fois par jour au plus", () => {
    expect(vercel.crons.length).toBeLessThanOrEqual(2);
    for (const c of vercel.crons) expect(c.schedule, c.path).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
  });
  it("aucune durée maximale au-delà de 300 secondes", () => {
    for (const [pattern, cfg] of Object.entries(vercel.functions)) expect((cfg as { maxDuration: number }).maxDuration, pattern).toBeLessThanOrEqual(300);
  });
  it("aucune route ne demande plus de 300 secondes (limite de l'offre gratuite)", () => {
    for (const file of sources(join(process.cwd(), "src"))) {
      const m = readFileSync(file, "utf8").match(/export const maxDuration = (\d+)/);
      if (m) expect(Number(m[1]), file).toBeLessThanOrEqual(300);
    }
  });
});
