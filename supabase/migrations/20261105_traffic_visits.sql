-- Visites des pages publiques, agrégées par jour, source (ChatGPT, Perplexity, Google…) et page.
-- Aucune donnée personnelle : seulement des compteurs. Accessible uniquement au service (RLS sans politique).
create table if not exists public.traffic_visits (
  day date not null,
  source text not null,
  path text not null,
  visits integer not null default 0,
  primary key (day, source, path)
);
alter table public.traffic_visits enable row level security;

create or replace function public.bump_traffic_visit(p_source text, p_path text)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.traffic_visits (day, source, path, visits)
  values ((now() at time zone 'Europe/Paris')::date, left(p_source, 40), left(p_path, 200), 1)
  on conflict (day, source, path) do update set visits = public.traffic_visits.visits + 1;
$$;
revoke all on function public.bump_traffic_visit(text, text) from public, anon, authenticated;
grant execute on function public.bump_traffic_visit(text, text) to service_role;
