-- Liste d'attente retirée : tables et fonction de comptage des parrainages de la liste.
drop function if exists public.increment_referral_count(text);
drop table if exists public.waitlist_signups cascade;
drop table if exists public.waitlist cascade;
