import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";

/**
 * Petites données propres à un utilisateur (objectifs, règles parentales, carnet de révisions, alertes déjà envoyées...).
 * Rangées dans `app_settings` (clé « u:<id utilisateur>:<nom> », JSON), table fermée au navigateur : seules les routes
 * serveur y accèdent. Une seule écriture par requête (jamais de lecture-modification en boucle).
 */
const key = (userId: number | string, name: string) => `u:${userId}:${name}`;

export async function getUserData<T>(userId: number | string, name: string, fallback: T): Promise<T> {
  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", key(userId, name)).maybeSingle();
  return data?.value && typeof data.value === "object" ? ({ ...fallback, ...(data.value as object) } as T) : fallback;
}

export async function setUserData(userId: number | string, name: string, value: unknown): Promise<void> {
  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert({ key: key(userId, name), value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

/** Lit la même donnée pour plusieurs utilisateurs d'un coup (tableau de bord famille, tâche planifiée). */
export async function getUserDataMany<T>(userIds: (number | string)[], name: string, fallback: T): Promise<Map<string, T>> {
  const out = new Map<string, T>();
  if (!userIds.length) return out;
  const keys = userIds.map((id) => key(id, name));
  const { data } = await supabaseAdmin.from("app_settings").select("key, value").in("key", keys);
  const byKey = new Map((data ?? []).map((r) => [r.key as string, r.value]));
  for (const id of userIds) {
    const v = byKey.get(key(id, name));
    out.set(String(id), v && typeof v === "object" ? ({ ...fallback, ...(v as object) } as T) : fallback);
  }
  return out;
}

export async function deleteUserData(userId: number | string, name: string): Promise<void> {
  await supabaseAdmin.from("app_settings").delete().eq("key", key(userId, name));
}
