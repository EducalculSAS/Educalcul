/**
 * Base en mémoire qui imite la partie de l'API Supabase utilisée par les routes (select/insert/update/upsert/delete + filtres simples).
 * Sert aux tests d'intégration des routes : on vérifie ce qui est écrit en base et ce qui part par e-mail, sans réseau.
 */
type Row = Record<string, unknown>;
type Result = { data: unknown; error: { code?: string; message: string } | null };

export class FakeDb {
  tables: Record<string, Row[]> = {};
  /** Colonne unique par table (une insertion en double renvoie l'erreur Postgres 23505). */
  unique: Record<string, string> = {};
  private nextId = 1;

  rows(table: string): Row[] { return (this.tables[table] ??= []); }

  from(table: string) {
    let op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
    let payload: Row | Row[] | null = null;
    const filters: ((r: Row) => boolean)[] = [];
    let wantSingle = false;
    let returning = false;
    let limitN: number | null = null;

    const run = (): Result => {
      const all = this.rows(table);
      const matches = () => all.filter((r) => filters.every((f) => f(r)));
      if (op === "insert" || op === "upsert") {
        const items = Array.isArray(payload) ? payload : [payload as Row];
        const out: Row[] = [];
        for (const item of items) {
          const col = this.unique[table];
          if (col && all.some((r) => r[col] === item[col])) {
            if (op === "upsert") { Object.assign(all.find((r) => r[col] === item[col])!, item); continue; }
            return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
          }
          const row = { id: this.nextId++, ...item };
          all.push(row); out.push(row);
        }
        return { data: wantSingle ? out[0] ?? null : returning ? out : null, error: null };
      }
      if (op === "update") {
        const hit = matches(); hit.forEach((r) => Object.assign(r, payload));
        return { data: returning ? hit : null, error: null };
      }
      if (op === "delete") {
        const hit = matches(); this.tables[table] = all.filter((r) => !hit.includes(r));
        return { data: returning ? hit : null, error: null };
      }
      let res = matches(); if (limitN !== null) res = res.slice(0, limitN);
      return { data: wantSingle ? res[0] ?? null : res, error: null };
    };

    const q: Record<string, unknown> = {
      select: () => { if (op !== "select") returning = true; return q; },
      insert: (p: Row | Row[]) => { op = "insert"; payload = p; return q; },
      upsert: (p: Row | Row[]) => { op = "upsert"; payload = p; return q; },
      update: (p: Row) => { op = "update"; payload = p; return q; },
      delete: () => { op = "delete"; return q; },
      eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return q; },
      neq: (c: string, v: unknown) => { filters.push((r) => r[c] !== v); return q; },
      in: (c: string, v: unknown[]) => { filters.push((r) => v.includes(r[c])); return q; },
      is: (c: string, v: unknown) => { filters.push((r) => (r[c] ?? null) === v); return q; },
      order: () => q,
      limit: (n: number) => { limitN = n; return q; },
      maybeSingle: () => { wantSingle = true; return q; },
      single: () => { wantSingle = true; return q; },
      then: (ok: (r: Result) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad),
    };
    return q;
  }

  rpc() { return Promise.resolve({ data: null, error: null }); }
}
