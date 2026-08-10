import { supabaseAdmin } from "@/lib/supabaseClient";

/** Petit cache mémoire (30s) pour éviter une requête DB à chaque appel — un
 * flag n'a pas besoin d'être temps réel à la seconde près, et ça évite de
 * surcharger la base si un flag est vérifié sur un chemin chaud (page très
 * visitée, route API appelée souvent). Le cache vit par instance serverless,
 * donc une désactivation peut mettre jusqu'à 30s à se propager partout —
 * acceptable pour l'usage visé ("désactiver une fonctionnalité cassée sans
 * redéployer"), pas pour un kill-switch qui doit être instantané. */
const CACHE_TTL_MS = 30_000;
let cache: { flags: Map<string, boolean>; expiresAt: number } | null = null;

async function loadFlags(): Promise<Map<string, boolean>> {
  if (cache && cache.expiresAt > Date.now()) return cache.flags;
  const { data } = await supabaseAdmin.from("feature_flags").select("key, enabled");
  const flags = new Map((data || []).map((f) => [f.key, f.enabled]));
  cache = { flags, expiresAt: Date.now() + CACHE_TTL_MS };
  return flags;
}

/** true si le flag est activé OU s'il n'existe pas du tout (une fonctionnalité
 * sans flag créé est considérée activée par défaut — pas besoin de créer un
 * flag pour chaque route, seulement pour celles qu'on veut pouvoir couper). */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  const flags = await loadFlags();
  return flags.has(key) ? !!flags.get(key) : true;
}
