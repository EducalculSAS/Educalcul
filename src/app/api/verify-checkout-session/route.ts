import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseClient';

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
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
