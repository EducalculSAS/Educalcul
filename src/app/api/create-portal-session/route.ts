import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getAuthenticatedUser } from '@/lib/apiAuth';
import { getRequestSiteUrl } from '@/lib/siteUrl';
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";

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
       // Le client Stripe du compte est retrouvé par l'identifiant du compte (métadonnée `user_id` posée à sa
       // création), jamais par l'e-mail : deux clients Stripe peuvent porter la même adresse.
       const found = await stripe.customers.search({ query: `metadata['user_id']:'${userId}'`, limit: 1 });
       if (found.data[0]) subscription = { stripe_customer_id: found.data[0].id };
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
      return_url: `${getRequestSiteUrl(req)}/parent/subscription`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error('Stripe Portal error:', error);
    return NextResponse.json(
      { error: sanitizeErrorMessage(errMessage(error) || String(error)) },
      { status: 500 }
    );
  }
}
