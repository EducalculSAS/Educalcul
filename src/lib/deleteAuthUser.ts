import { supabaseAdmin } from "@/lib/supabaseClient";

/**
 * Supprime un compte Supabase Auth, avec un retry puis un repli sur
 * `admin_force_delete_auth_user` (fonction SQL SECURITY DEFINER) si l'API Admin
 * échoue encore — elle peut renvoyer un "Database error deleting user" générique.
 * Un compte "fantôme" (profil supprimé, connexion Auth orpheline) a déjà été
 * observé en prod pour cette raison.
 *
 * Source unique partagée par toutes les routes qui suppriment un compte
 * (parent, enfant, admin) — voir aussi delete_user_account (RPC) pour la
 * suppression du profil public.users associé.
 */
export async function deleteAuthUser(authId: string, label = authId): Promise<boolean> {
  let { error } = await supabaseAdmin.auth.admin.deleteUser(authId);
  if (error) {
    console.warn(`[deleteAuthUser] échec pour ${label}, retry:`, JSON.stringify(error));
    await new Promise((r) => setTimeout(r, 500));
    ({ error } = await supabaseAdmin.auth.admin.deleteUser(authId));
  }
  if (error) {
    console.warn(`[deleteAuthUser] API Admin toujours KO pour ${label}, repli admin_force_delete_auth_user:`, JSON.stringify(error));
    const { error: rpcError } = await supabaseAdmin.rpc("admin_force_delete_auth_user", { target_auth_id: authId });
    if (rpcError) {
      console.error(`[deleteAuthUser] repli aussi en échec pour ${label}:`, JSON.stringify(rpcError));
      return false;
    }
  }
  return true;
}
