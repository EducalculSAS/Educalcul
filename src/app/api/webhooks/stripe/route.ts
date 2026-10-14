import { NextResponse } from "next/server";
import { stripe, subscriptionPeriodEnd } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sendEmail } from "@/lib/mailer";
import {
  cancellationRevokedEmail, cancellationScheduledEmail, paymentFailedEmail, paymentSucceededEmail,
  subscriptionEndedEmail, trialEndingEmail, trialStartedEmail, welcomeEmail,
} from "@/lib/emailTemplates";
import { notify } from "@/lib/notify";
import Stripe from "stripe";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";

const frDate = (d: string | number | null | undefined) =>
  d ? new Date(typeof d === "number" ? d * 1000 : d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }) : null;

/** Le parent derrière un abonnement (par client ou par abonnement Stripe), avec sa formule. */
async function getSubscriber(column: "stripe_customer_id" | "stripe_subscription_id", value: string) {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id, plan_id, current_period_end")
    .eq(column, value)
    .maybeSingle();
  if (!data?.user_id) return null;
  const [{ data: profile }, { data: plan }] = await Promise.all([
    supabaseAdmin.from("users").select("first_name, email").eq("auth_id", data.user_id).maybeSingle(),
    supabaseAdmin.from("subscription_plans").select("name").eq("id", data.plan_id ?? -1).maybeSingle(),
  ]);
  if (!profile?.email) return null;
  return {
    firstName: (profile.first_name as string) || "",
    email: profile.email as string,
    authId: data.user_id as string,
    planName: (plan?.name as string) || "Educalcul",
  };
}

// Toujours attendu (await) par les appelants : sur Vercel, un envoi lancé sans être
// attendu peut être coupé dès que la réponse au webhook est partie.
const mail = (to: { email: string; firstName: string }, tmpl: { subject: string; textPart: string; htmlPart: string }) =>
  sendEmail({ toEmail: to.email, toName: to.firstName || "Utilisateur", ...tmpl }).catch(console.error);

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
  } catch (err: unknown) {
    console.error("Webhook signature failed:", errMessage(err));
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err) || String(err)) }, { status: 400 });
  }

  // Stripe garantit une livraison "au moins une fois" — un meme evenement
  // (meme event.id) peut legitimement arriver deux fois (retry, double
  // forwarding...). Constate en test : checkout.session.completed livre deux
  // fois de suite, dupliquant l'entree referral_uses et l'email de bienvenue.
  // L'insert echoue sur la contrainte PRIMARY KEY si l'event a deja ete traite
  // — on s'arrete alors immediatement, avant tout effet de bord.
  const { error: dedupeError } = await supabaseAdmin
    .from("stripe_processed_events")
    .insert({ event_id: event.id });
  if (dedupeError) {
    if (dedupeError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[webhook] Could not record processed event:", dedupeError.message);
    // Ne bloque pas le traitement pour une erreur de journalisation seule.
  }

  try {
    switch (event.type) {

      // ── Checkout completed → create subscription in DB ─────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;   // auth_id
        const planId = session.metadata?.planId;   // numeric plan id as string

        if (!userId || !planId) break;

        // ── Nouvel inscrit : le profil public.users n'existe pas encore — le
        // compte Auth a été créé AVANT paiement (create-checkout-session) mais
        // sans profil, pour qu'il n'ait aucun accès tant que Stripe n'a pas
        // confirmé le paiement. C'est ICI, et seulement ici, qu'il est créé. ──
        if (session.metadata?.isNewSignup === "true") {
          const { data: existingProfile } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("auth_id", userId)
            .maybeSingle();

          if (!existingProfile) {
            const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
            const meta = authUser?.user?.user_metadata || {};
            const profileEmail = authUser?.user?.email || session.customer_details?.email || "";

            const { error: insertError } = await supabaseAdmin.from("users").insert({
              auth_id: userId,
              first_name: meta.first_name || "",
              last_name: meta.last_name || "",
              email: profileEmail,
              role: meta.role === "child" ? "child" : "parent",
              status: "active",
              cgu_accepted_at: new Date().toISOString(),
            });

            if (insertError) {
              console.error("[webhook] Could not create profile for new signup:", insertError.message);
              // Ne pas break ici : on tente quand même d'enregistrer l'abonnement plus
              // bas si jamais le profil existe déjà (contrainte unique déjà passée).
            } else if (profileEmail) {
              try {
                const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
                  type: "magiclink",
                  email: profileEmail,
                  options: { redirectTo: "https://educalcul.com/auth/callback" },
                });
                const confirmUrl = linkData?.properties?.action_link || "https://educalcul.com/parent/dashboard";
                const tmpl = welcomeEmail(meta.first_name || "", confirmUrl);
                await sendEmail({ toEmail: profileEmail, toName: `${meta.first_name || ""} ${meta.last_name || ""}`.trim(), ...tmpl }).catch(console.error);
              } catch (e) {
                console.warn("[webhook] Could not send welcome email:", e);
              }
            }
          }
        }

        // Get Stripe subscription details — indépendant de la ligne
        // subscriptions existante, lancés en parallèle.
        const [stripeSub, { data: existingSub }] = await Promise.all([
          session.subscription ? stripe.subscriptions.retrieve(session.subscription as string) : Promise.resolve(null),
          supabaseAdmin.from("subscriptions").select("stripe_subscription_id").eq("user_id", userId).maybeSingle(),
        ]);
        let periodEnd: string | null = null;
        let stripeSubId: string | null = null;
        if (stripeSub) {
          // Lecture compatible avec toutes les versions de l'API Stripe (voir
          // subscriptionPeriodEnd) : l'ancienne lecture directe donnait une
          // date invalide avec l'API récente et faisait échouer l'événement.
          periodEnd = subscriptionPeriodEnd(stripeSub);
          stripeSubId = stripeSub.id;
        }

        // Un utilisateur ne doit avoir qu'un seul abonnement Stripe actif :
        // on annule l'ancien s'il existe et diffère du nouveau

        const oldSubId = existingSub?.stripe_subscription_id;
        if (oldSubId && oldSubId !== stripeSubId) {
          try {
            await stripe.subscriptions.cancel(oldSubId);
          } catch (e: unknown) {
            console.warn("Could not cancel previous subscription:", errMessage(e));
          }
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

        // Essai gratuit : aucun paiement donc aucun autre email. On annonce
        // la fin de l'essai et le montant du premier prélèvement.
        if (stripeSub?.status === "trialing" && stripeSub.trial_end) {
          const subscriber = await getSubscriber("stripe_subscription_id", stripeSub.id);
          const price = stripeSub.items?.data?.[0]?.price;
          if (subscriber && price?.unit_amount != null) {
            const amount = `${(price.unit_amount / 100).toFixed(2).replace(".", ",")} €${price.recurring?.interval === "year" ? " / an" : " / mois"}`;
            await mail(subscriber, trialStartedEmail(subscriber.firstName, subscriber.planName, frDate(stripeSub.trial_end)!, amount));
          }
        }

        // Enregistre l'usage du code de parrainage, mais NE recompense PAS
        // encore le parrain ici : cet evenement se declenche aussi pour un
        // simple debut d'essai (0€ preleve). La recompense (10% pour le
        // parrain) n'est appliquee qu'au premier VRAI paiement du filleul,
        // voir invoice.payment_succeeded plus bas (confirmed_paid).
        const referralCode = session.metadata?.referralCode;
        if (referralCode) {
          const [{ data: rc }, { data: userRow }] = await Promise.all([
            supabaseAdmin.from("referral_codes").select("id, current_uses").eq("code", referralCode).single(),
            supabaseAdmin.from("users").select("id").eq("auth_id", userId).maybeSingle(),
          ]);
          if (rc && userRow) {
            await supabaseAdmin.from("referral_uses").insert({ referral_code_id: rc.id, used_by_user_id: userRow.id });
            await supabaseAdmin.from("referral_codes").update({ current_uses: rc.current_uses + 1 }).eq("id", rc.id);
          }
        }
        break;
      }

      // ── Subscription updated (renewal, upgrade, downgrade) ──────────────
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        // Depuis l'API Stripe 2025-07-30 ("basil"), current_period_end n'est
        // plus sur l'objet subscription mais sur chaque item de facturation.
        const rawPeriodEnd = (sub as any).current_period_end ?? sub.items?.data?.[0]?.current_period_end;
        // "trialing" est un abonnement legitimement actif (periode d'essai en
        // cours, deja payante en intention) — normalise en "active" comme le
        // fait deja checkout.session.completed, sinon le premier evenement
        // update qui arrive pendant l'essai (ex: on programme une annulation)
        // ecrit le VRAI statut Stripe et fait perdre l'acces avant l'heure :
        // partout ailleurs dans l'app, seul status === "active" est reconnu.
        const isEntitled = sub.status === "active" || sub.status === "trialing";
        // Une résiliation programmée arrive soit en cancel_at_period_end,
        // soit en date de fin (cancel_at) selon l'endroit où elle est faite.
        const scheduled = !!sub.cancel_at_period_end || !!sub.cancel_at;
        const update: Record<string, any> = {
          status: isEntitled ? "active" : sub.status,
          cancel_at_period_end: scheduled,
          updated_at: new Date().toISOString(),
        };
        if (rawPeriodEnd) update.current_period_end = new Date(rawPeriodEnd * 1000).toISOString();
        await supabaseAdmin.from("subscriptions").update(update).eq("stripe_subscription_id", sub.id);

        // Confirmation écrite de la résiliation avec sa date d'effet
        // (Code de la consommation, art. L.215-1-1), ou de son annulation.
        const prev = (event.data.previous_attributes || {}) as Partial<Stripe.Subscription>;
        if (isEntitled && ("cancel_at_period_end" in prev || "cancel_at" in prev)) {
          // Pendant un essai, Stripe remplit aussi cancel_at en même temps que
          // cancel_at_period_end : une date de fin qui n'apparaît pas dans les
          // anciennes valeurs en découle, elle n'existait pas avant.
          const periodEndChanged = "cancel_at_period_end" in prev;
          const wasScheduled = !!(periodEndChanged ? prev.cancel_at_period_end : sub.cancel_at_period_end)
            || !!("cancel_at" in prev ? prev.cancel_at : periodEndChanged ? null : sub.cancel_at);
          if (wasScheduled !== scheduled) {
            const subscriber = await getSubscriber("stripe_subscription_id", sub.id);
            const endDate = frDate(sub.cancel_at || rawPeriodEnd);
            if (subscriber) {
              await mail(subscriber, scheduled
                ? cancellationScheduledEmail(subscriber.firstName, subscriber.planName, endDate || "la fin de la période en cours")
                : cancellationRevokedEmail(subscriber.firstName, subscriber.planName, endDate));
              await notify({
                userId: subscriber.authId,
                type: "subscription",
                title: scheduled ? "Résiliation confirmée" : "Abonnement réactivé",
                body: scheduled ? `Accès jusqu'au ${endDate}` : "Votre abonnement continue",
                link: "/parent/subscription",
              });
            }
          }
        }
        break;
      }

      // ── Trial ends in 3 days → rappel avec le montant du premier prélèvement ──
      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        // Déjà résilié pendant l'essai : rien à rappeler.
        if (!sub.trial_end || sub.cancel_at_period_end || sub.cancel_at) break;
        const subscriber = await getSubscriber("stripe_subscription_id", sub.id);
        const price = sub.items?.data?.[0]?.price;
        if (subscriber && price?.unit_amount != null) {
          const amount = `${(price.unit_amount / 100).toFixed(2).replace(".", ",")} €${price.recurring?.interval === "year" ? " / an" : " / mois"}`;
          await mail(subscriber, trialEndingEmail(subscriber.firstName, subscriber.planName, frDate(sub.trial_end)!, amount));
          await notify({ userId: subscriber.authId, type: "subscription", title: "Votre essai se termine bientôt", body: `Fin de l'essai le ${frDate(sub.trial_end)}`, link: "/parent/subscription" });
        }
        break;
      }

      // ── Subscription cancelled ──────────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { data: ended } = await supabaseAdmin.from("subscriptions").update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        }).eq("stripe_subscription_id", sub.id).select("id");
        // Aucune ligne : ancien abonnement remplacé par un changement de
        // formule, ou compte supprimé : pas d'email « abonnement terminé ».
        // Rétractation : son propre email a déjà été envoyé (src/lib/withdrawal.ts).
        if (ended?.length && sub.metadata?.withdrawn !== "true") {
          const subscriber = await getSubscriber("stripe_subscription_id", sub.id);
          if (subscriber) await mail(subscriber, subscriptionEndedEmail(subscriber.firstName, subscriber.planName));
        }
        break;
      }

      // ── Invoice paid (renewal confirmed) ────────────────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        // Depuis l'API Stripe recente ("basil"+), invoice.subscription n'existe
        // plus a la racine — l'id migre sous invoice.parent.subscription_details.
        // Sans le fallback, subId etait TOUJOURS undefined et tout ce bloc
        // (reactivation apres paiement, recompense de parrainage, has_paid)
        // ne s'executait jamais, silencieusement. Trouve en testant un vrai
        // paiement de bout en bout (essai termine -> facture reelle payee).
        const subId = ((invoice as any).subscription || (invoice as any).parent?.subscription_details?.subscription) as string | undefined;
        const isRealPayment = (invoice.amount_paid || 0) > 0;

        if (subId) {
          await supabaseAdmin.from("subscriptions").update({
            status: "active",
            updated_at: new Date().toISOString(),
          }).eq("stripe_subscription_id", subId);

          // Recompense de parrainage : seulement au tout PREMIER vrai paiement
          // du filleul (jamais au demarrage d'un essai a 0€, sinon on peut
          // parrainer quelqu'un qui annule avant d'avoir jamais paye). has_paid
          // rend ce bloc idempotent (les renouvellements suivants ne repassent
          // pas dedans).
          if (isRealPayment) {
            const { data: subRow } = await supabaseAdmin
              .from("subscriptions")
              .select("id, user_id, has_paid")
              .eq("stripe_subscription_id", subId)
              .maybeSingle();

            if (subRow && !subRow.has_paid) {
              await supabaseAdmin.from("subscriptions").update({ has_paid: true }).eq("id", subRow.id);

              const { data: userProfile } = await supabaseAdmin
                .from("users")
                .select("id")
                .eq("auth_id", subRow.user_id)
                .maybeSingle();

              if (userProfile) {
                const { data: pendingUse } = await supabaseAdmin
                  .from("referral_uses")
                  .select("id, referral_code_id")
                  .eq("used_by_user_id", userProfile.id)
                  .eq("confirmed_paid", false)
                  .maybeSingle();

                if (pendingUse) {
                  const { data: rc } = await supabaseAdmin
                    .from("referral_codes")
                    .select("owner_user_id")
                    .eq("id", pendingUse.referral_code_id)
                    .maybeSingle();
                  if (rc?.owner_user_id) {
                    await supabaseAdmin.from("users").update({ pending_discount_percent: 10 }).eq("id", rc.owner_user_id);
                  }
                  await supabaseAdmin.from("referral_uses").update({ confirmed_paid: true, subscription_id: subRow.id }).eq("id", pendingUse.id);
                }
              }
            }
          }
        }

        // Email facture + notification — seulement pour un vrai montant
        // preleve (une facture d'essai a 0€ n'a rien a "confirmer").
        const user = await getSubscriber("stripe_customer_id", invoice.customer as string);
        if (user && invoice.hosted_invoice_url && isRealPayment) {
          const amount = `${(invoice.amount_paid / 100).toFixed(2).replace(".", ",")} €`;
          const nextDate = frDate(invoice.lines?.data?.[0]?.period?.end);
          await mail(user, paymentSucceededEmail(user.firstName, amount, user.planName, nextDate, invoice.hosted_invoice_url));
          await notify({ userId: user.authId, type: "payment", title: "Paiement confirmé", body: `${amount} encaissés`, link: "/parent/subscription" });
        }
        break;
      }

      // ── Invoice failed ───────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        // Meme bascule d'API que invoice.payment_succeeded ci-dessus — sans le
        // fallback, un paiement de renouvellement refuse ne marquait JAMAIS le
        // compte "past_due", qui gardait donc un acces complet malgre l'echec.
        const failedSubId = ((invoice as any).subscription || (invoice as any).parent?.subscription_details?.subscription) as string | undefined;
        if (failedSubId) {
          await supabaseAdmin.from("subscriptions").update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          }).eq("stripe_subscription_id", failedSubId);
        }

        // Email paiement échoué + notification urgente
        const user = await getSubscriber("stripe_customer_id", invoice.customer as string);
        if (user) {
          await mail(user, paymentFailedEmail(user.firstName));
          await notify({ userId: user.authId, type: "payment_failed", title: "Échec du paiement", body: "Mettez à jour votre moyen de paiement", link: "/parent/subscription" });
        }
        break;
      }
    }
  } catch (err: unknown) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err) || String(err)) }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
