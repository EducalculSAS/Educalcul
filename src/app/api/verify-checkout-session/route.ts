import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getAuthenticatedUser } from '@/lib/apiAuth';
import { sanitizeErrorMessage } from '@/lib/safeError';

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session ID' },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      // Update user subscription in database
      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId;

      // Le compte est créé côté serveur au moment du checkout (voir
      // create-checkout-session) mais le client ne se connecte qu'APRÈS ce
      // retour Stripe — donc pas de session pour un tout nouvel inscrit. On
      // exige une session dès qu'elle existe, et dans ce cas elle doit
      // correspondre au compte visé par CE paiement (ou être admin) : un
      // sessionId Stripe connu ne suffit plus, seul, à déclencher une
      // resynchro pour un autre compte que le sien.
      const me = await getAuthenticatedUser(req);
      if (me && userId && me.authId !== userId && me.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (userId && planId) {
        // Update or insert subscription using Admin Client to bypass RLS
        // We use userId (UUID) directly as the new table schema expects UUID
        const { error } = await supabaseAdmin
          .from('subscriptions')
          .upsert({
            user_id: userId,
            plan_id: planId,
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(), // 30 days
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
          }, {
            onConflict: 'user_id' // Ensure one active subscription per user
          });

        if (error) {
          console.error('Database update error:', error);
          // Return success anyway if payment is confirmed, but log the error
          // The user can contact support if subscription is not active
          // Or we could implement a retry mechanism
          // Ne pas renvoyer l'objet `session` complet (PII : e-mail, client
          // Stripe, montants) — le client n'a besoin que du statut.
          return NextResponse.json(
            {
              status: 'success',
              warning: 'Payment successful but database update failed. Please contact support.'
            }
          );
        }
      }

      return NextResponse.json({ status: 'success' });
    } else {
      return NextResponse.json(
        { status: 'pending', message: 'Payment not completed' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Stripe error:', error);
    return NextResponse.json(
      { error: sanitizeErrorMessage(error?.message || String(error)) },
      { status: 500 }
    );
  }
}
