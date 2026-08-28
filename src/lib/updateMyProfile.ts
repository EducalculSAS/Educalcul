/**
 * Met à jour un ou plusieurs champs du profil de l'utilisateur connecté via
 * `/api/user/profile` (allowlist stricte côté serveur). Remplace les anciens
 * `supabase.from("users").update(...)` éparpillés dans les composants client.
 */
/** Lit le profil de l'utilisateur connecté (champs non sensibles) via
 * `GET /api/user/profile`. Remplace les `supabase.from("users").select(...)
 * .eq("auth_id", ...)` côté client. */
export async function getMyProfile<T = Record<string, unknown>>(): Promise<T | null> {
  try {
    const res = await fetch("/api/user/profile");
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
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
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || "Échec de la mise à jour" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur réseau" };
  }
}
