/**
 * Met à jour un ou plusieurs champs du profil de l'utilisateur connecté via
 * `/api/user/profile` (allowlist stricte côté serveur). Remplace les anciens
 * `supabase.from("users").update(...)` éparpillés dans les composants client.
 */
/** Lit le profil de l'utilisateur connecté (champs non sensibles) via
 * `GET /api/user/profile`. Remplace les `supabase.from("users").select(...)
 * .eq("auth_id", ...)` côté client. */
// Plusieurs composants d'une même page (barre de navigation, suivi de
// présence, onboarding, Calia…) lisent le profil au montage : une seule
// requête partagée, gardée quelques secondes, au lieu d'un appel chacun.
const PROFILE_TTL_MS = 5_000;
let profileCache: { at: number; promise: Promise<unknown> } | null = null;

export async function getMyProfile<T = Record<string, unknown>>(): Promise<T | null> {
  if (!profileCache || Date.now() - profileCache.at > PROFILE_TTL_MS) {
    const promise = fetch("/api/user/profile")
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
    profileCache = { at: Date.now(), promise };
    // Un échec ne doit pas rester en cache.
    promise.then((v) => { if (v === null) profileCache = null; });
  }
  return (await profileCache.promise) as T | null;
}

export async function updateMyProfile(
  patch: Record<string, string | boolean>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    profileCache = null; // la prochaine lecture repart du serveur
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || "Échec de la mise à jour" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur réseau" };
  }
}
