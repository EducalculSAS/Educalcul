import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getAuthenticatedUser } from '@/lib/apiAuth';
import { getSiteUrl } from '@/lib/siteUrl';

export async function POST(req: Request) {
  try {
    // The billing portal must only ever be opened for the caller's own account.
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = me.authId;

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
      return_url: `${getSiteUrl()}/parent/subscription`,
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
