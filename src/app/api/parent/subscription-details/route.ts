import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing user ID' },
        { status: 400 }
      );
    }

    // 1. Get subscription from Supabase to find Stripe Customer ID
    let { data: subscription, error: dbError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    // Auto-Healing: If no subscription in DB, check Stripe by email
    if (!subscription || !subscription.stripe_customer_id) {
      // Get user email
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

      if (userData?.user?.email) {
        const customers = await stripe.customers.list({
          email: userData.user.email,
          limit: 1,
        });

        if (customers.data.length > 0) {
          const customer = customers.data[0];
          // Check for active subscriptions
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'active',
            limit: 1,
          });

          if (subscriptions.data.length > 0) {
            const activeSub = subscriptions.data[0];
            // Determine plan ID based on amount/product (simplified logic)
            // Ideally should match price ID
            let planId = 'premium'; // Default fallback
            if (activeSub.items.data[0].price.unit_amount === 1999) {
              planId = 'family';
            }

            // Insert into Supabase (Auto-Heal)
            const { data: newSub, error: insertError } = await supabaseAdmin
              .from('subscriptions')
              .upsert({
                user_id: userId,
                plan_id: planId,
                status: 'active',
                current_period_start: new Date((activeSub as any).current_period_start * 1000).toISOString(),
                current_period_end: new Date((activeSub as any).current_period_end * 1000).toISOString(),
                stripe_customer_id: customer.id,
                stripe_subscription_id: activeSub.id,
              }, { onConflict: 'user_id' })
              .select()
              .single();

            if (newSub) {
              subscription = newSub;
            } else if (insertError) {
              console.error('Auto-healing failed:', insertError);
              // Even if insert fails, use the stripe data for display
              subscription = {
                user_id: userId,
                plan_id: planId,
                status: 'active',
                stripe_customer_id: customer.id,
                stripe_subscription_id: activeSub.id,
                current_period_end: new Date((activeSub as any).current_period_end * 1000).toISOString(),
                cancel_at_period_end: activeSub.cancel_at_period_end,
              };
            }
          }
        }
      }
    }

    if (dbError && !subscription) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!subscription || !subscription.stripe_customer_id) {
      return NextResponse.json({
        subscription: null,
        invoices: []
      });
    }

    const customerId = subscription.stripe_customer_id;

    // 2. Fetch subscription details from Stripe to get renewal date
    let stripeSubscription = null;
    if (subscription.stripe_subscription_id) {
      stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripe_subscription_id
      );
    }

    // 3. Fetch invoices from Stripe
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 12, // Last 12 invoices
      status: 'paid',
    });

    const formattedInvoices = invoices.data.map(invoice => ({
      id: invoice.id,
      date: new Date(invoice.created * 1000).toISOString(),
      amount: invoice.amount_paid / 100, // Convert cents to currency unit
      currency: invoice.currency.toUpperCase(),
      status: invoice.status,
      pdf_url: invoice.invoice_pdf,
      number: invoice.number,
    }));

    return NextResponse.json({
      subscription: {
        ...subscription,
        current_period_end: stripeSubscription
          ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
          : subscription.current_period_end,
        cancel_at_period_end: stripeSubscription?.cancel_at_period_end || false,
      },
      invoices: formattedInvoices,
    });

  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
