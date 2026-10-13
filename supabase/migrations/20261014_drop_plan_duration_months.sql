-- `subscription_plans.duration_months` (« Engagement (mois) » dans l'admin) n'était lue nulle part : aucune route, page,
-- fonction, vue, index ni règle ne l'utilisait, et les 7 plans l'avaient à 0 ou vide. La période de facturation vit dans
-- `billing_interval` (voir 20261013_billing_period_free_duration.sql).
alter table public.subscription_plans drop column if exists duration_months;
