-- Vérification de l'adresse e-mail des comptes parents (src/lib/emailVerification.ts).
alter table public.users add column if not exists email_verified_at timestamptz;
alter table public.users add column if not exists email_verify_token_hash text;
alter table public.users add column if not exists email_verify_expires_at timestamptz;
-- Comptes déjà existants : considérés comme vérifiés (on ne bloque personne a posteriori).
update public.users set email_verified_at = coalesce(created_at, now()) where email_verified_at is null;
create index if not exists users_email_verify_token_idx on public.users (email_verify_token_hash) where email_verify_token_hash is not null;
