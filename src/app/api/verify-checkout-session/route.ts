import { NextResponse } from 'next/server';
import { stripe, subscriptionIsEntitled, subscriptionPeriodEnd } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getAuthenticatedUser } from '@/lib/apiAuth';
import { sanitizeErrorMessage } from '@/lib/safeError';
import { rateLimitWithBackoff } from '@/lib/rateLimitAdvanced';

/** Au-delà, un identifiant de session de paiement n'est plus accepté. */
const MAX_SESSION_AGE_MS = 48 * 60 * 60 * 1000;

/**
 * Retour de Stripe après paiement : accélère la mise à jour de l'abonnement
 * sans attendre le webhook (qui reste la source de vérité).
 *
 * Avant : tout appel avec un identifiant de session PAYÉE réécrivait
 * l'abonnement « actif, fin dans 30 jours à partir de maintenant ». Rappeler
 * la route avec une vieille session réactivait donc gratuitement un
 * abonnement résilié, sans limite, et un abonnement annuel repassait à 30
 * jours. Désormais : session récente et terminée uniquement, et l'état écrit
 * est celui de l'abonnement Stripe réel (statut, fin de période).
 */
export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = await rateLimitWithBackoff(`verify-checkout:${ip}`, 30, 60 * 60 * 1000);
    if (!rl.allowed) return NextResponse.json({ error: 'Trop de tentatives' }, { status: 429 });

    const { sessionId } = await req.json().catch(() => ({}));
    if (typeof sessionId !== 'string' || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // « complete » couvre le paiement ET le début d'un essai gratuit (Stripe :
    // « aucun paiement requis »), que l'ancienne vérification refusait.
    if (session.status !== 'complete') {
      return NextResponse.json({ status: 'pending', message: 'Payment not completed' }, { status: 400 });
    }
    if (Date.now() - session.created * 1000 > MAX_SESSION_AGE_MS) {
      return NextResponse.json({ status: 'success' }); // ancien paiement : le webhook a déjà tout fait
    }

    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;

    // Un compte connecté ne peut confirmer que SON paiement (ou être admin).
    const me = await getAuthenticatedUser(req);
    if (me && userId && me.authId !== userId && me.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (userId && planId && session.subscription) {
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      if (subscriptionIsEntitled(sub)) {
        const { error } = await supabaseAdmin.from('subscriptions').upsert(
          {
            user_id: userId,
            plan_id: planId,
            status: 'active',
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: sub.id,
            current_period_end: subscriptionPeriodEnd(sub),
            cancel_at_period_end: sub.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
        if (error) {
          console.error('[verify-checkout-session] database update error:', error.message);
          return NextResponse.json({
            status: 'success',
            warning: 'Payment successful but database update failed. Please contact support.',
          });
        }
      }
    }

    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    console.error('[verify-checkout-session]', error?.message);
    return NextResponse.json({ error: sanitizeErrorMessage(error?.message || String(error)) }, { status: 500 });
  }
}
