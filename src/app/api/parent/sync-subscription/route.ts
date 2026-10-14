import { NextResponse } from "next/server";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { stripe, subscriptionPeriodEnd } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser } from "@/lib/apiAuth";

// GET — sync current subscription status from Stripe to DB
export async function GET(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const authId = me.authId;

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_subscription_id, plan_id")
      .eq("user_id", authId)
      .maybeSingle();

    if (!sub?.stripe_subscription_id) return NextResponse.json({ synced: false });

    // Pull live status from Stripe
    let stripeSub;
    try {
      stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    } catch (err) {
      // Abonnement disparu chez Stripe (compte de test, suppression) : rien à synchroniser.
      if ((err as { code?: string })?.code === "resource_missing") return NextResponse.json({ synced: false, missing: true });
      throw err;
    }

    const newStatus = stripeSub.status === "active" ? "active"
      : stripeSub.status === "canceled" ? "cancelled"
      : stripeSub.status;

    await supabaseAdmin.from("subscriptions").update({
      status: newStatus,
      plan_id: sub.plan_id, // keep existing unless you store price→plan mapping
      current_period_end: subscriptionPeriodEnd(stripeSub),
      cancel_at_period_end: stripeSub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    }).eq("user_id", authId);

    return NextResponse.json({ synced: true, status: newStatus, cancel_at_period_end: stripeSub.cancel_at_period_end });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}

// POST — sync after Stripe checkout redirect with session_id
export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { sessionId } = await req.json();
    const authId = me.authId;
    if (!sessionId) return NextResponse.json({ error: "Missing params" }, { status: 400 });
    // "free" est le sentinel utilisé pour le plan gratuit (pas de session Stripe
    // réelle à synchroniser) — le compte a déjà été créé directement par
    // /api/auth/create-account, rien à faire ici.
    if (sessionId === "free") return NextResponse.json({ success: true, plan_id: "free" });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.payment_status !== "paid" && session.status !== "complete") {
      return NextResponse.json({ error: "Session not paid" }, { status: 400 });
    }

    const planId = session.metadata?.planId;
    if (!planId) return NextResponse.json({ error: "No planId in metadata" }, { status: 400 });

    // ✓ SECURITY : sans ce contrôle, un session_id Stripe payé par un AUTRE
    // utilisateur (visible dans l'URL de retour ?session_id=..., donc
    // potentiellement dans l'historique navigateur / un outil d'analytics)
    // pouvait être rejoué ici par n'importe quel compte authentifié pour
    // s'attribuer le même plan payant sans payer.
    if (session.metadata?.userId && session.metadata.userId !== authId) {
      return NextResponse.json({ error: "Session non autorisée" }, { status: 403 });
    }

    const sub = session.subscription as any;

    await supabaseAdmin.from("subscriptions").upsert({
      user_id: authId,
      plan_id: planId,
      status: "active",
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: sub?.id ?? null,
      current_period_start: sub ? new Date(sub.current_period_start * 1000).toISOString() : new Date().toISOString(),
      current_period_end: subscriptionPeriodEnd(sub),
      cancel_at_period_end: sub?.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return NextResponse.json({ success: true, plan_id: planId });
  } catch (err: unknown) {
    console.error("sync-subscription error:", err);
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
