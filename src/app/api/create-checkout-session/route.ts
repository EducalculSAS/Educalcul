import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getAuthenticatedUser, getAuthIdentityOnly } from '@/lib/apiAuth';
import { computeCustomPlan } from '@/lib/customPlanPricing';
import { normalizePricingConfig } from '@/lib/pricingConfig';
import { getSiteUrl } from '@/lib/siteUrl';
import { validateEmail, validateName } from '@/lib/validation';
import { rateLimitWithBackoff, RATE_LIMITS } from '@/lib/rateLimitAdvanced';
import { sanitizeErrorMessage } from '@/lib/safeError';

// Crée (ou réutilise) le compte Supabase Auth d'un nouvel inscrit, AVANT tout
// paiement — mais aucune ligne public.users n'est créée ici : c'est le webhook
// Stripe (checkout.session.completed) qui la crée, uniquement une fois le
// paiement confirmé. Tant que ça n'arrive pas, ce compte n'a aucun profil et
// donc aucun accès réel à l'app (RLS bloque tout sans ligne public.users).
async function createOrResumePendingSignup(params: {
  email: string; firstName: string; lastName: string; password: string;
}): Promise<{ authId: string } | { error: string }> {
  const { email, firstName, lastName, password } = params;

  const { data: existingProfile } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existingProfile) {
    return { error: 'Cet email est déjà utilisé. Connectez-vous ou utilisez un autre email.' };
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName, role: 'parent' },
  });

  if (!createError && created.user) {
    return { authId: created.user.id };
  }

  // Email déjà présent côté Auth mais sans profil = inscription abandonnée
  // avant paiement (ex: fermeture de l'onglet sur la page Stripe). On reprend
  // ce compte au lieu de bloquer l'utilisateur qui retente son inscription.
  const isDuplicate = /already.*registered|already.*exists/i.test(createError?.message || '');
  if (!isDuplicate) {
    return { error: sanitizeErrorMessage(createError?.message || 'Could not create account') };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  const lookupRes = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: { apikey: key!, Authorization: `Bearer ${key}` },
  });
  const lookupJson = await lookupRes.json().catch(() => null);
  const existingAuthUser = Array.isArray(lookupJson?.users) ? lookupJson.users[0] : lookupJson?.[0];
  if (!existingAuthUser?.id) {
    return { error: 'Cet email est déjà utilisé. Connectez-vous ou utilisez un autre email.' };
  }

  // Vérifie encore une fois qu'il n'a réellement aucun profil (paranoïa anti-race).
  const { data: recheckProfile } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('auth_id', existingAuthUser.id)
    .maybeSingle();
  if (recheckProfile) {
    return { error: 'Cet email est déjà utilisé. Connectez-vous ou utilisez un autre email.' };
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
    password,
    user_metadata: { first_name: firstName, last_name: lastName, role: 'parent' },
  });
  if (updateError) return { error: sanitizeErrorMessage(updateError.message) };

  return { authId: existingAuthUser.id };
}

export async function POST(req: Request) {
  try {
    // URL de base de confiance (config serveur) — jamais l'en-tête Origin du
    // client, qui peut être falsifié (open redirect via les URLs Stripe).
    const baseUrl = getSiteUrl();
    let {
      planId, userId, email, referralCode, isNewSignup, customConfig,
      firstName, lastName, password,
    } = await req.json();

    if ((!planId && !customConfig) || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Existing-user actions must be bound to the authenticated caller.
    if (!isNewSignup) {
      const me = await getAuthenticatedUser(req);
      if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      userId = me.authId;
    } else {
      // Déjà authentifié (ex: inscription via Google, compte Auth déjà créé
      // par l'OAuth callback, mais sans profil public.users tant que non payé).
      const identity = await getAuthIdentityOnly(req);
      userId = identity?.authId || '';
    }

    let plan: any = null;

    if (customConfig) {
      // SECURITY: never trust a client-supplied price/features. Recompute the
      // custom plan authoritatively from the raw config server-side, using the
      // pricing parameters loaded from the DB (editable in admin) — never from
      // client-supplied pricing.
      const { data: cfgRow } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'pricing_config')
        .maybeSingle();
      const pricing = normalizePricingConfig(cfgRow?.value).custom;
      const computed = computeCustomPlan(customConfig.config ?? customConfig, pricing);
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
        console.error('[create-checkout-session] custom plan creation error:', customErr);
        return NextResponse.json({ error: sanitizeErrorMessage(customErr?.message || 'Could not create custom plan') }, { status: 500 });
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
        return NextResponse.json({ url: `${baseUrl}/parent/subscription?success=1` });
      }
      // For new signups on free plan, redirect with success so account gets created
      return NextResponse.json({ url: `${baseUrl}/parent/subscription?new=true&success=1&session_id=free` });
    }

    // Paid plan + new signup, not already authenticated (classic email/password
    // form, as opposed to Google) → create the pending Auth account NOW, so its
    // id can travel in the Stripe session metadata. No public.users row yet —
    // the webhook creates it once Stripe confirms the payment.
    if (isNewSignup && !userId) {
      const validatedFirstName = validateName(firstName);
      const validatedLastName = validateName(lastName || '');
      if (!validatedFirstName || !password || !validateEmail(email)) {
        return NextResponse.json({ error: 'Missing or invalid signup fields' }, { status: 400 });
      }

      const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
      const rlConfig = RATE_LIMITS['auth:signup'];
      const rl = await rateLimitWithBackoff(`auth:signup:${ip}`, rlConfig.maxAttempts, rlConfig.windowMs);
      if (!rl.allowed) {
        return NextResponse.json({ error: 'Trop de tentatives d\'inscription, réessaie plus tard.' }, { status: 429 });
      }

      const result = await createOrResumePendingSignup({
        email: email.trim().toLowerCase(),
        firstName: validatedFirstName,
        lastName: validatedLastName || '',
        password,
      });
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      userId = result.authId;
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

    const origin = baseUrl;
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

    // authId renvoyé pour les nouveaux inscrits : c'est l'identifiant fiable
    // à utiliser pour vérifier la création du compte après paiement — l'email
    // affiché sur la page Stripe reste modifiable par le payeur et ne doit
    // jamais servir de clé de recherche.
    return NextResponse.json({ sessionId: session.id, url: session.url, authId: isNewSignup ? userId : undefined });
  } catch (error: any) {
    console.error('Stripe error:', error);
    return NextResponse.json({ error: sanitizeErrorMessage(error?.message || String(error)) }, { status: 500 });
  }
}
