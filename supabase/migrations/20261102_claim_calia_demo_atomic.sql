-- Compteur de la démo Calia : incrément ATOMIQUE sous la limite (deux requêtes simultanées ne peuvent plus dépasser le plafond).
-- Renvoie le nouveau compteur, ou -1 si la limite est déjà atteinte.
create or replace function public.claim_calia_demo(p_id text, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v integer;
begin
  insert into public.calia_demo_usage (ip, count)
  values (p_id, 1)
  on conflict (ip) do update
    set count = public.calia_demo_usage.count + 1, used_at = now()
    where public.calia_demo_usage.count < p_limit
  returning count into v;
  return coalesce(v, -1);
end;
$$;
revoke all on function public.claim_calia_demo(text, integer) from public, anon, authenticated;
grant execute on function public.claim_calia_demo(text, integer) to service_role;

-- Clé étrangère error_logs.user_id sans index couvrant (signalé par le linter de performance).
create index if not exists error_logs_user_id_idx on public.error_logs (user_id);
