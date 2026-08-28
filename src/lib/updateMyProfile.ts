/**
 * Met à jour un ou plusieurs champs du profil de l'utilisateur connecté via
 * `/api/user/profile` (allowlist stricte côté serveur). Remplace les anciens
 * `supabase.from("users").update(...)` éparpillés dans les composants client.
 */
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
