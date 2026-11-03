import { getClientIp } from "@/lib/apiAuth";
import type Stripe from "stripe";
import type { Row } from "@/types/db";
import { NextResponse } from 'next/server';
import { getVatTaxRateId } from "@/lib/stripeVat";
import { ensurePlanPrice, ensureProduct, recurringFor } from "@/lib/stripeCatalog";
import { getOrCreateStripeCustomer } from "@/lib/stripeCustomer";
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getAuthenticatedUser, getAuthIdentityOnly } from '@/lib/apiAuth';
import { computeCustomPlan } from '@/lib/customPlanPricing';
import { normalizePricingConfig } from '@/lib/pricingConfig';
import { getRequestSiteUrl } from '@/lib/siteUrl';
import { validateEmail, validateName } from '@/lib/validation';
import { rateLimitWithBackoff, RATE_LIMITS } from '@/lib/rateLimitAdvanced';
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { computeWaitlistFreeTrialDays } from '@/lib/waitlistReferralCredit';

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
    // URL de base de confiance : le domaine réellement utilisé par la requête
    // s'il fait partie de la liste blanche de l'app, sinon la config serveur.
    // Jamais un Origin arbitraire du client (open redirect via Stripe).
    const baseUrl = getRequestSiteUrl(req);
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
      //
      // ATTENTION : ne JAMAIS faire confiance à cette identité sans vérifier
      // qu'elle n'a PAS déjà de profil public.users. Sinon, quiconque a une
      // session active dans ce navigateur au moment de "créer un nouveau
      // compte" (onglet resté connecté, ordinateur partagé, admin qui teste
      // le flux d'inscription...) se retrouve avec l'abonnement du nouvel
      // inscrit attaché à SON PROPRE compte existant à la place — bug réel
      // constaté en test (un abonnement Family s'est créé sur un compte
      // admin au lieu du nouveau compte de test).
      const identity = await getAuthIdentityOnly(req);
      if (identity?.authId) {
        const { data: existingProfile } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('auth_id', identity.authId)
          .maybeSingle();
        userId = existingProfile ? '' : identity.authId;
      } else {
        userId = '';
      }
    }

    let plan: Pick<Row<'subscription_plans'>, 'id' | 'name' | 'price' | 'billing_interval' | 'trial_days' | 'is_active'>;

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
      const pricingConfig = normalizePricingConfig(cfgRow?.value);
      // Le sur-mesure masqué en admin n'est plus vendu, même par un appel direct à cette route.
      if (!pricingConfig.visibility.custom) {
        return NextResponse.json({ error: "Cette formule n'est plus proposée." }, { status: 403 });
      }
      const pricing = pricingConfig.custom;
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
        .select('id, name, price, billing_interval, trial_days, is_active')
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
        .select('id, name, price, billing_interval, trial_days, is_active')
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

      const ip = getClientIp(req);
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

    // Resolve discount from referral code or pending reward — les deux
    // requêtes sont indépendantes, lancées en parallèle.
    let discountPercent = 0;

    const [{ data: rc }, { data: userRow }] = await Promise.all([
      referralCode
        ? supabaseAdmin
            .from('referral_codes')
            .select('discount_type, discount_value')
            .eq('code', referralCode.trim().toUpperCase())
            .eq('is_active', true)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      !isNewSignup && userId
        ? supabaseAdmin
            .from('users')
            .select('pending_discount_percent, id, first_name, last_name')
            .eq('auth_id', userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (rc && rc.discount_type === 'percent') {
      discountPercent = Math.max(discountPercent, rc.discount_value);
    }

    if (userRow?.pending_discount_percent > 0) {
      discountPercent = Math.max(discountPercent, userRow?.pending_discount_percent || 0);
    }

    const priceInCents = Math.round(plan.price * 100);
    const discountedPrice = discountPercent > 0
      ? Math.round(priceInCents * (1 - discountPercent / 100))
      : priceInCents;

    const recurring = recurringFor(plan.billing_interval);

    // Prix Stripe du catalogue (voir stripeCatalog.ts) : le produit et le prix
    // sont créés / mis à jour depuis la base. Avec une remise de parrainage
    // (montant différent), on garde le PRODUIT du catalogue avec un montant à
    // la volée. Si Stripe ne répond pas au catalogue, on retombe sur l'ancien
    // fonctionnement (prix en ligne) plutôt que de bloquer le paiement.
    let lineItem: Stripe.Checkout.SessionCreateParams.LineItem;
    try {
      const isCustom = !!customConfig;
      if (isCustom) {
        const productId = await ensureProduct('Sur mesure', 'Abonnement personnalisé');
        lineItem = { price_data: { currency: 'eur', product: productId, unit_amount: discountedPrice, recurring }, quantity: 1 };
      } else {
        const { productId, priceId } = await ensurePlanPrice(plan);
        lineItem = discountPercent > 0
          ? { price_data: { currency: 'eur', product: productId, unit_amount: discountedPrice, recurring }, quantity: 1 }
          : { price: priceId, quantity: 1 };
      }
    } catch (catalogErr) {
      console.error('[create-checkout-session] catalogue Stripe indisponible, prix en ligne :', (catalogErr as Error).message);
      lineItem = { price_data: { currency: 'eur', product_data: { name: plan.name }, unit_amount: discountedPrice, recurring }, quantity: 1 };
    }
    // TVA incluse dans le prix affiché, si le taux existe dans Stripe (voir stripeVat.ts).
    const vatRateId = await getVatTaxRateId();
    if (vatRateId) lineItem.tax_rates = [vatRateId];

    const origin = baseUrl;
    const stripeCustomerId = await getOrCreateStripeCustomer({
      authId: userId,
      email,
      name: `${userRow?.first_name || firstName || ''} ${userRow?.last_name || lastName || ''}`.trim() || undefined,
    });
    const sessionData: Stripe.Checkout.SessionCreateParams & { payment_method_types?: string[] } = {
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
      // Le client Stripe est celui du compte (créé une fois, réutilisé ensuite) :
      // plus de client anonyme en double à chaque paiement (voir stripeCustomer.ts).
      customer: stripeCustomerId,
      client_reference_id: userId || undefined,
      metadata: { userId: userId || '', planId: planId.toString(), referralCode: referralCode || '', isNewSignup: isNewSignup ? 'true' : 'false' },
    };

    // Semaines gratuites gagnées pendant la phase liste d'attente (paliers de
    // parrainage confirmés + bonus premiers arrivés) — converties en jours
    // d'essai Stripe, cumulées avec l'essai propre au plan. Ne s'applique
    // qu'aux comptes issus de la waitlist (0 sinon) ; calculé à la volée à
    // partir de faits déjà durables (waitlist_signups, subscriptions), donc
    // rien à persister ni à "consommer" comme pending_discount_percent.
    const waitlistBonusDays = userId ? await computeWaitlistFreeTrialDays(userId) : 0;
    const trialDays = (plan.trial_days || 0) + waitlistBonusDays;
    // Métadonnées sur l'abonnement Stripe lui-même (compte et formule) : lisibles
    // dans le tableau de bord Stripe et présentes sur tous ses événements.
    sessionData.subscription_data = {
      metadata: { userId: userId || '', planId: planId.toString() },
      ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
    };

    // Acceptation des CGV et demande d'accès immédiat (droit de rétractation :
    // remboursement au prorata), affichées au-dessus du bouton de paiement.
    sessionData.custom_text = {
      submit: {
        message:
          "En confirmant, vous acceptez les Conditions générales de vente (educalcul.com/cgv) et demandez l'accès immédiat au service. Vous gardez 14 jours pour vous rétracter (remboursement au prorata de la période non utilisée).",
      },
    };
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
  } catch (error: unknown) {
    console.error('Stripe error:', error);
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error) || String(error)) }, { status: 500 });
  }
}
