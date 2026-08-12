import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { stripe } from "@/lib/stripe";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { getAuthenticatedUser } from "@/lib/apiAuth";

/** Supprime un compte Supabase Auth, avec un retry puis un repli sur
 * admin_force_delete_auth_user (fonction SQL SECURITY DEFINER) si l'API
 * Admin échoue encore — elle peut renvoyer une erreur générique "Database
 * error deleting user" sans cause identifiable côté schéma applicatif. Un
 * compte "fantôme" (profil supprimé, connexion Auth orpheline) a déjà été
 * observé en prod pour cette raison. */
async function deleteAuthUser(authId: string, label: string): Promise<boolean> {
  let { error } = await supabaseAdmin.auth.admin.deleteUser(authId);
  if (error) {
    console.warn(`[delete-account] Auth deletion failed for ${label}, retrying:`, JSON.stringify(error));
    await new Promise(r => setTimeout(r, 500));
    ({ error } = await supabaseAdmin.auth.admin.deleteUser(authId));
  }
  if (error) {
    console.warn(`[delete-account] Auth API still failing for ${label}, falling back to admin_force_delete_auth_user:`, JSON.stringify(error));
    const { error: rpcError } = await supabaseAdmin.rpc("admin_force_delete_auth_user", { target_auth_id: authId });
    if (rpcError) {
      console.error(`[delete-account] Fallback deletion also failed for ${label}:`, JSON.stringify(rpcError));
      return false;
    }
  }
  return true;
}

export async function DELETE(req: Request) {
  try {
    // ✓ SECURITY : cette route utilisait supabaseAdmin.auth.getUser(token)
    // directement, ce qui contournait le gate 2FA obligatoire et le contrôle
    // de compte banni appliqués partout ailleurs via getAuthenticatedUser —
    // un token volé permettait de supprimer le compte (+ tous les enfants)
    // sans re-vérification, malgré la 2FA activée par le parent.
    const me = await getAuthenticatedUser(req);
    if (!me) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const parentAuthId = me.authId;
    console.log("[delete-account] Starting deletion for auth_id:", parentAuthId);

    // Récupérer les auth_ids des enfants AVANT suppression
    const { data: parentRow } = await supabaseAdmin
      .from("users").select("id").eq("auth_id", parentAuthId).maybeSingle();

    let childAuthIds: string[] = [];
    if (parentRow?.id) {
      const { data: children } = await supabaseAdmin
        .from("users")
        .select("auth_id")
        .eq("parent_id", parentRow.id)
        .eq("role", "child");
      childAuthIds = (children || []).map(c => c.auth_id).filter(Boolean);
      console.log("[delete-account] Children to delete:", childAuthIds);
    }

    // 1. Annuler l'abonnement Stripe si existant (non-bloquant)
    try {
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("stripe_subscription_id, stripe_customer_id")
        .eq("user_id", parentAuthId)
        .maybeSingle();

      if (sub?.stripe_subscription_id) {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
        console.log("[delete-account] Stripe subscription cancelled:", sub.stripe_subscription_id);
      }
    } catch (stripeErr: any) {
      // Non bloquant : si déjà annulé ou inexistant, on continue
      console.warn("[delete-account] Stripe cancel warning (non-fatal):", stripeErr?.message);
    }

    // 2. Supprimer toutes les données public.users (cascade automatique)
    const { error: rpcError } = await supabaseAdmin.rpc("delete_user_account", {
      p_auth_id: parentAuthId,
    });
    if (rpcError) {
      console.error("[delete-account] RPC error:", rpcError);
      return NextResponse.json({ error: sanitizeErrorMessage(rpcError.message) }, { status: 500 });
    }
    console.log("[delete-account] public.users deleted via RPC");

    // 3. Supprimer les auth users enfants — avec repli si l'API Admin
    // échoue (voir deleteAuthUser ci-dessous : même filet que la route admin).
    for (const childAuthId of childAuthIds) {
      const ok = await deleteAuthUser(childAuthId, `child ${childAuthId}`);
      if (!ok) console.error(`[delete-account] Could not delete child auth ${childAuthId} (public.users déjà supprimé)`);
    }

    // 4. Supprimer le auth user parent
    const parentOk = await deleteAuthUser(parentAuthId, "parent");
    if (!parentOk) {
      return NextResponse.json({ error: "Le compte a été supprimé mais la connexion associée n'a pas pu l'être — contacte le support technique." }, { status: 500 });
    }
    console.log("[delete-account] Parent auth deleted successfully");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[delete-account] Unexpected error:", error);
    return NextResponse.json({ error: sanitizeErrorMessage(error?.message || "Erreur interne") }, { status: 500 });
  }
}
