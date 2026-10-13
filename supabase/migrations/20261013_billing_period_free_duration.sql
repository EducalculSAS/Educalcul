-- Durées de facturation libres : en plus de month / quarter / semester / year / one_time,
-- une période « m<N> » = N mois (m2 = bimestriel, m18 = 18 mois…), de 1 à 36 mois (plafond Stripe : 3 ans).
-- La durée se lit dans l'identifiant (voir src/lib/billingPeriods.ts) : aucune autre colonne n'est nécessaire.
alter table public.subscription_plans drop constraint if exists subscription_plans_billing_interval_check;
alter table public.subscription_plans add constraint subscription_plans_billing_interval_check
  check (
    billing_interval in ('month', 'quarter', 'semester', 'year', 'one_time')
    or billing_interval ~ '^m([1-9]|[12][0-9]|3[0-6])$'
  );
