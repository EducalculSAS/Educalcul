import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseClient";
import Stripe from "stripe";

export const config = { api: { bodyParser: false } };

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || !sig) {
    return NextResponse.json({ error: "Webhook secret missing" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature failed:", err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  try {
    switch (event.type) {

      // ── Checkout completed → create subscription in DB ─────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;   // auth_id
        const planId = session.metadata?.planId;   // numeric plan id as string

        if (!userId || !planId) break;

        // Get Stripe subscription details
        let periodEnd: string | null = null;
        let stripeSubId: string | null = null;
        if (session.subscription) {
          const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string);
          periodEnd = new Date(stripeSub.current_period_end * 1000).toISOString();
          stripeSubId = stripeSub.id;
        }

        await supabaseAdmin.from("subscriptions").upsert({
          user_id: userId,
          plan_id: planId,
          status: "active",
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: stripeSubId,
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        // Apply referral code if used
        const referralCode = session.metadata?.referralCode;
        if (referralCode) {
          const { data: rc } = await supabaseAdmin.from("referral_codes").select("id, current_uses, owner_user_id").eq("code", referralCode).single();
          if (rc) {
            const { data: userRow } = await supabaseAdmin.from("users").select("id").eq("auth_id", userId).maybeSingle();
            if (userRow) {
              await supabaseAdmin.from("referral_uses").insert({ referral_code_id: rc.id, used_by_user_id: userRow.id });
              await supabaseAdmin.from("referral_codes").update({ current_uses: rc.current_uses + 1 }).eq("id", rc.id);
              if (rc.owner_user_id) {
                await supabaseAdmin.from("users").update({ pending_discount_percent: 10 }).eq("id", rc.owner_user_id);
              }
            }
          }
        }
        break;
      }

      // ── Subscription updated (renewal, upgrade, downgrade) ──────────────
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await supabaseAdmin.from("subscriptions").update({
          status: sub.status === "active" ? "active" : sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        }).eq("stripe_subscription_id", sub.id);
        break;
      }

      // ── Subscription cancelled ──────────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await supabaseAdmin.from("subscriptions").update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        }).eq("stripe_subscription_id", sub.id);
        break;
      }

      // ── Invoice paid (renewal confirmed) ────────────────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await supabaseAdmin.from("subscriptions").update({
            status: "active",
            updated_at: new Date().toISOString(),
          }).eq("stripe_subscription_id", invoice.subscription as string);
        }
        break;
      }

      // ── Invoice failed ───────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await supabaseAdmin.from("subscriptions").update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          }).eq("stripe_subscription_id", invoice.subscription as string);
        }
        break;
      }
    }
  } catch (err: any) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
