import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendEmail } from "@/lib/mailer";
import { buildEmailHtml, EMAIL_BASE_URL } from "@/lib/emailTemplates";
import { notify } from "@/lib/notify";
import Stripe from "stripe";

async function getUserByCustomerId(customerId: string) {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (!data?.user_id) return null;
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("first_name, email, auth_id")
    .eq("auth_id", data.user_id)
    .maybeSingle();
  return profile ? { ...profile, authId: data.user_id } : null;
}

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
          periodEnd = new Date((stripeSub as any).current_period_end * 1000).toISOString();
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
          current_period_end: new Date((sub as any).current_period_end * 1000).toISOString(),
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
        if ((invoice as any).subscription) {
          await supabaseAdmin.from("subscriptions").update({
            status: "active",
            updated_at: new Date().toISOString(),
          }).eq("stripe_subscription_id", (invoice as any).subscription as string);
        }

        // Email facture + notification
        const user = await getUserByCustomerId(invoice.customer as string);
        if (user && invoice.hosted_invoice_url) {
          const amount = (invoice.amount_paid / 100).toFixed(2);
          sendEmail({
            toEmail: user.email,
            toName: user.first_name || "Utilisateur",
            subject: "Votre paiement a été confirmé",
            textPart: `Bonjour ${user.first_name},\n\nVotre paiement de ${amount}€ a bien été enregistré.\n\nL'équipe Educalcul`,
            htmlPart: buildEmailHtml({
              title: "Paiement confirmé",
              body: `<p>Bonjour <strong>${user.first_name}</strong>,</p><p>Votre paiement de <strong>${amount} €</strong> a bien été enregistré. Votre accès est actif.</p>`,
              cta: { label: "Voir ma facture", url: invoice.hosted_invoice_url },
            }),
          }).catch(console.error);
          notify({ userId: user.authId, type: "payment", title: "Paiement confirmé", body: `${amount} € encaissés`, link: "/parent/subscription" });
        }
        break;
      }

      // ── Invoice failed ───────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if ((invoice as any).subscription) {
          await supabaseAdmin.from("subscriptions").update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          }).eq("stripe_subscription_id", (invoice as any).subscription as string);
        }

        // Email paiement échoué + notification urgente
        const user = await getUserByCustomerId(invoice.customer as string);
        if (user) {
          sendEmail({
            toEmail: user.email,
            toName: user.first_name || "Utilisateur",
            subject: "Problème avec votre paiement Educalcul",
            textPart: `Bonjour ${user.first_name},\n\nNous n'avons pas pu encaisser votre paiement. Veuillez mettre à jour votre moyen de paiement.\n\nL'équipe Educalcul`,
            htmlPart: buildEmailHtml({
              title: "Problème de paiement",
              body: `
                <p>Bonjour <strong>${user.first_name}</strong>,</p>
                <p>Nous n'avons pas pu traiter votre paiement pour votre abonnement Educalcul.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;">
                  <tr><td style="background:#fff3cd;border-left:3px solid #c5a148;padding:14px 18px;border-radius:0 8px 8px 0;">
                    <p style="margin:0;font-size:13px;color:#92400e;">Mettez à jour votre moyen de paiement pour conserver votre accès à Educalcul.</p>
                  </td></tr>
                </table>
              `,
              cta: { label: "Mettre à jour mon paiement", url: `${EMAIL_BASE_URL}/parent/subscription` },
            }),
          }).catch(console.error);
          notify({ userId: user.authId, type: "payment_failed", title: "Échec du paiement", body: "Mettez à jour votre moyen de paiement", link: "/parent/subscription" });
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
