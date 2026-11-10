-- Jours gratuits gagnés comme parrain, en attente d'un abonnement (src/lib/referral.ts).
alter table public.users add column if not exists referral_free_days integer not null default 0;
