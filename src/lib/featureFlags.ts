/**
 * État des fonctionnalités (voir src/lib/featureCatalog.ts) : seules les
 * fonctionnalités DÉSACTIVÉES sont lues en base, avec le message éventuel de
 * l'admin. Requête REST directe (pas le client supabase-js) pour être
 * utilisable dans le proxy, et cache mémoire de 10 s : un changement dans
 * l'admin se propage partout en 10 s au plus, sans requête à chaque page.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE!;
const TTL_MS = 10_000;

let cache: { disabled: Map<string, string | null>; expiresAt: number } | null = null;
let inflight: Promise<Map<string, string | null>> | null = null;

/** Clés désactivées → message affiché (null = message par défaut). */
export async function getDisabledFeatures(): Promise<Map<string, string | null>> {
  if (cache && cache.expiresAt > Date.now()) return cache.disabled;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/feature_flags?select=key,message&enabled=eq.false`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      const rows: { key: string; message: string | null }[] = await res.json();
      const disabled = new Map(rows.map((r) => [r.key, r.message?.trim() || null]));
      cache = { disabled, expiresAt: Date.now() + TTL_MS };
      return disabled;
    } catch {
      // Base injoignable : on garde le dernier état connu, sinon tout ouvert
      // (une panne de lecture ne doit pas fermer le site entier).
      return cache?.disabled ?? new Map();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Vide le cache de CETTE instance (après une modification depuis l'admin). */
export function invalidateFeatureCache() {
  cache = null;
}

/** true si la fonctionnalité est active (ou inconnue). Pour les vérifications
 * faites dans le code, en plus du blocage des chemins par le proxy. */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  return !(await getDisabledFeatures()).has(key);
}
