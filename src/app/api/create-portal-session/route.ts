import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing user ID' },
        { status: 400 }
      );
    }

    // Get subscription to find Stripe Customer ID
    let { data: subscription, error: dbError } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    // Auto-Healing for Portal: If no sub in DB, check Stripe by email
    if (dbError || !subscription || !subscription.stripe_customer_id) {
       const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
       if (userData?.user?.email) {
          const customers = await stripe.customers.list({
            email: userData.user.email,
            limit: 1,
          });
          if (customers.data.length > 0) {
            subscription = { stripe_customer_id: customers.data[0].id };
          }
       }
    }

    if (!subscription || !subscription.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Create Customer Portal Session
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${req.headers.get('origin')}/parent/subscription`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Portal error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
