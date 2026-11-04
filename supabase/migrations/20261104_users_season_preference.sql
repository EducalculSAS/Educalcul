-- Thème du site choisi dans le profil (saisons : voir src/lib/season.ts).
alter table public.users add column if not exists season_preference text;
alter table public.users drop constraint if exists users_season_preference_check;
alter table public.users add constraint users_season_preference_check check (season_preference is null or season_preference in ('auto','classique','noel','paques','foot','halloween'));
