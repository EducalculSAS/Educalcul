import { z } from "zod";

/**
 * Validation à l'exécution des données qui ne viennent pas du code : colonnes JSON de la base, imports, session
 * du navigateur. Une donnée invalide ne fait jamais tomber la page : on la journalise et on l'écarte.
 */

function report(label: string, issues: z.core.$ZodIssue[] | undefined, extra = "") {
  const first = issues?.[0];
  console.warn(`[validate] ${label} : donnée ignorée${extra}${first ? ` (${first.path.join(".") || "racine"} : ${first.message})` : ""}`);
}

/** Valeur conforme au schéma, ou `null` (et un avertissement dans les journaux). */
export function parseOrNull<S extends z.ZodType>(schema: S, raw: unknown, label: string): z.output<S> | null {
  const r = schema.safeParse(raw);
  if (r.success) return r.data;
  report(label, r.error.issues);
  return null;
}

/** Liste dont on garde les éléments conformes ; tout ce qui n'est pas une liste donne `[]`. */
export function parseList<S extends z.ZodType>(schema: S, raw: unknown, label: string): z.output<S>[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    report(label, undefined, " (pas une liste)");
    return [];
  }
  const out: z.output<S>[] = [];
  let dropped = 0;
  let firstIssues: z.core.$ZodIssue[] | undefined;
  for (const item of raw) {
    const r = schema.safeParse(item);
    if (r.success) out.push(r.data);
    else {
      dropped++;
      firstIssues ??= r.error.issues;
    }
  }
  if (dropped) report(label, firstIssues, ` (${dropped} sur ${raw.length})`);
  return out;
}

/** Relation « vers un » de Supabase : un objet, ou un tableau d'un élément selon la requête. */
export function relationOne<S extends z.ZodType>(schema: S, raw: unknown): z.output<S> | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v == null) return null;
  const r = schema.safeParse(v);
  return r.success ? r.data : null;
}

/** Schéma dont on ne contrôle que la forme minimale (objet portant ces clés) : le reste du contenu est libre. */
export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
