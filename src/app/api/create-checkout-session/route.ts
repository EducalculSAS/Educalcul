import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getAuthenticatedUser } from '@/lib/apiAuth';
import { computeCustomPlan } from '@/lib/customPlanPricing';

export async function POST(req: Request) {
  try {
    let { planId, userId, email, referralCode, isNewSignup, customConfig } = await req.json();

    if ((!planId && !customConfig) || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Existing-user actions must be bound to the authenticated caller; new
    // signups have no account/session yet so they pass through unauthenticated.
    if (!isNewSignup) {
      const me = await getAuthenticatedUser(req);
      if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      userId = me.authId;
    } else {
      userId = userId || '';
    }

    let plan: any = null;

    if (customConfig) {
      // SECURITY: never trust a client-supplied price/features. Recompute the
      // custom plan authoritatively from the raw config server-side.
      const computed = computeCustomPlan(customConfig.config ?? customConfig);
      if (!computed) {
        return NextResponse.json({ error: 'Invalid custom configuration' }, { status: 400 });
      }
      // Crée un plan "sur mesure" caché (is_active=false) pour ce client uniquement
      const { data: customPlan, error: customErr } = await supabaseAdmin
        .from('subscription_plans')
        .insert({
          name: 'Sur mesure',
          description: 'Abonnement personnalisé',
          price: computed.price,
          billing_interval: 'month',
          trial_days: 0,
          is_active: false,
          features: computed.features,
        })
        .select('*')
        .single();

      if (customErr || !customPlan) {
        return NextResponse.json({ error: customErr?.message || 'Could not create custom plan' }, { status: 500 });
      }
      plan = customPlan;
      planId = customPlan.id;
    } else {
      // Fetch plan from DB
      const { data: dbPlan } = await supabaseAdmin
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .eq('is_active', true)
        .maybeSingle();

      if (!dbPlan) {
        return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 });
      }
      plan = dbPlan;
    }

    if (plan.price === 0) {
      // Free plan — no Stripe needed
      if (!isNewSignup && userId) {
        // For existing users, record directly
        await supabaseAdmin.from('subscriptions').upsert({
          user_id: userId,
          plan_id: planId.toString(),
          status: 'active',
          current_period_start: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        return NextResponse.json({ url: `${req.headers.get('origin')}/parent/subscription?success=1` });
      }
      // For new signups on free plan, redirect with success so account gets created
      return NextResponse.json({ url: `${req.headers.get('origin')}/parent/subscription?new=true&success=1&session_id=free` });
    }

    // Resolve discount from referral code or pending reward
    let discountPercent = 0;

    if (referralCode) {
      const { data: rc } = await supabaseAdmin
        .from('referral_codes')
        .select('*')
        .eq('code', referralCode.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (rc && rc.discount_type === 'percent') {
        discountPercent = Math.max(discountPercent, rc.discount_value);
      }
    }

    // Check pending parrainage reward (only for existing users)
    let userRow: any = null;
    if (!isNewSignup && userId) {
      const { data } = await supabaseAdmin
        .from('users')
        .select('pending_discount_percent, id')
        .eq('auth_id', userId)
        .maybeSingle();
      userRow = data;
    }

    if (userRow?.pending_discount_percent > 0) {
      discountPercent = Math.max(discountPercent, userRow?.pending_discount_percent || 0);
    }

    const priceInCents = Math.round(plan.price * 100);
    const discountedPrice = discountPercent > 0
      ? Math.round(priceInCents * (1 - discountPercent / 100))
      : priceInCents;

    const RECURRING: Record<string, { interval: 'month' | 'year'; interval_count: number }> = {
      month:    { interval: 'month', interval_count: 1 },
      quarter:  { interval: 'month', interval_count: 3 },
      semester: { interval: 'month', interval_count: 6 },
      year:     { interval: 'year',  interval_count: 1 },
    };
    const recurring = RECURRING[plan.billing_interval] || RECURRING.month;

    const lineItem: any = {
      price_data: {
        currency: 'eur',
        product_data: { name: plan.name },
        unit_amount: discountedPrice,
        recurring,
      },
      quantity: 1,
    };

    const origin = req.headers.get('origin');
    const sessionData: any = {
      payment_method_types: ['card'],
      line_items: [lineItem],
      mode: 'subscription',
      // Pour les nouveaux signups : inclure new=true dans l'URL de retour
      // sinon isNewSignup sera false et le compte ne sera pas créé
      success_url: isNewSignup
        ? `${origin}/auth/inscription/success?session_id={CHECKOUT_SESSION_ID}`
        : `${origin}/parent/subscription?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: isNewSignup
        ? `${origin}/auth/inscription/select-plan`
        : `${origin}/parent/subscription`,
      customer_email: email,
      metadata: { userId: userId || '', planId: planId.toString(), referralCode: referralCode || '', isNewSignup: isNewSignup ? 'true' : 'false' },
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
        .maybeSingle();
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
