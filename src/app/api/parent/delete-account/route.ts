import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { stripe } from "@/lib/stripe";
import { sanitizeErrorMessage } from "@/lib/safeError";

export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    const token = authHeader.slice(7);

    // Vérifier le token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      console.error("Token invalid:", userError?.message);
      return NextResponse.json({ error: "Session invalide" }, { status: 401 });
    }

    const parentAuthId = user.id;
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

    // 3. Supprimer les auth users enfants
    for (const childAuthId of childAuthIds) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(childAuthId);
      if (error) {
        console.error(`[delete-account] Error deleting child ${childAuthId}:`, error.message);
      } else {
        console.log(`[delete-account] Child auth deleted: ${childAuthId}`);
      }
    }

    // 3. Supprimer le auth user parent — avec retry si needed
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(parentAuthId);
    if (deleteAuthError) {
      console.error("[delete-account] Error deleting parent auth:", deleteAuthError.message);
      // Tenter une deuxième fois après délai
      await new Promise(r => setTimeout(r, 500));
      const { error: retryError } = await supabaseAdmin.auth.admin.deleteUser(parentAuthId);
      if (retryError) {
        console.error("[delete-account] Retry failed:", retryError.message);
        return NextResponse.json({ error: sanitizeErrorMessage(retryError.message) }, { status: 500 });
      }
    }
    console.log("[delete-account] Parent auth deleted successfully");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[delete-account] Unexpected error:", error);
    return NextResponse.json({ error: sanitizeErrorMessage(error?.message || "Erreur interne") }, { status: 500 });
  }
}
