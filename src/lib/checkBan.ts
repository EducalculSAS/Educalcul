import { supabase } from "@/lib/supabaseClient";

/**
 * Vérifie si l'utilisateur connecté est banni.
 * Retourne true si banni (et appelle onBanned), false sinon.
 */
export async function isBanned(onBanned: () => void): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const { data } = await supabase
      .from("users")
      .select("status, ban_reason")
      .eq("auth_id", session.user.id)
      .maybeSingle();

    if (data?.status === "inactive" || data?.ban_reason) {
      onBanned();
      return true;
    }
  } catch {}
  return false;
}
