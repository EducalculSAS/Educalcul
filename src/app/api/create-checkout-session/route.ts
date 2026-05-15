import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { planId, userId, email, referralCode } = await req.json();

    if (!planId || !userId || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch plan from DB
    const { data: plan, error: planErr } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single();

    if (planErr || !plan) {
      return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 });
    }

    if (plan.price === 0) {
      // Free plan — no Stripe needed, just record it
      await supabaseAdmin.from('subscriptions').upsert({
        user_id: userId,
        plan_id: planId.toString(),
        status: 'active',
        started_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      return NextResponse.json({ url: `${req.headers.get('origin')}/parent/subscription?success=1` });
    }

    // Resolve discount from referral code or pending reward
    let discountPercent = 0;

    if (referralCode) {
      const { data: rc } = await supabaseAdmin
        .from('referral_codes')
        .select('*')
        .eq('code', referralCode.trim().toUpperCase())
        .eq('is_active', true)
        .single();

      if (rc && rc.discount_type === 'percent') {
        discountPercent = Math.max(discountPercent, rc.discount_value);
      }
    }

    // Check pending parrainage reward
    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('pending_discount_percent, id')
      .eq('auth_id', userId)
      .maybeSingle();

    if (userRow?.pending_discount_percent > 0) {
      discountPercent = Math.max(discountPercent, userRow.pending_discount_percent);
    }

    const priceInCents = Math.round(plan.price * 100);
    const discountedPrice = discountPercent > 0
      ? Math.round(priceInCents * (1 - discountPercent / 100))
      : priceInCents;

    const billingInterval = plan.billing_interval === 'year' ? 'year' : 'month';

    const lineItem: any = {
      price_data: {
        currency: 'eur',
        product_data: { name: plan.name },
        unit_amount: discountedPrice,
        recurring: { interval: billingInterval },
      },
      quantity: 1,
    };

    const sessionData: any = {
      payment_method_types: ['card'],
      line_items: [lineItem],
      mode: 'subscription',
      success_url: `${req.headers.get('origin')}/parent/subscription?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/parent/subscription`,
      customer_email: email,
      metadata: { userId, planId: planId.toString(), referralCode: referralCode || '' },
    };

    if (plan.trial_days > 0) {
      sessionData.subscription_data = { trial_period_days: plan.trial_days };
    }

    const session = await stripe.checkout.sessions.create(sessionData);

    // Record referral code usage and reward referrer
    if (referralCode) {
      const { data: rc } = await supabaseAdmin
        .from('referral_codes')
        .select('id, current_uses, owner_user_id')
        .eq('code', referralCode.trim().toUpperCase())
        .single();
      if (rc && userRow?.id) {
        await supabaseAdmin.from('referral_uses').insert({
          referral_code_id: rc.id,
          used_by_user_id: userRow.id,
        });
        await supabaseAdmin
          .from('referral_codes')
          .update({ current_uses: rc.current_uses + 1 })
          .eq('id', rc.id);
        if (rc.owner_user_id) {
          await supabaseAdmin
            .from('users')
            .update({ pending_discount_percent: 10 })
            .eq('id', rc.owner_user_id);
        }
      }
    }

    // Clear pending discount after use
    if (userRow?.id && userRow.pending_discount_percent > 0) {
      await supabaseAdmin
        .from('users')
        .update({ pending_discount_percent: 0 })
        .eq('id', userRow.id);
    }

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Stripe error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
