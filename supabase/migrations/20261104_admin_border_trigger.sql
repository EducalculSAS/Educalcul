-- Contour « Égide » : imposé aux administrateurs, interdit à tous les autres comptes.
-- Garantie en base : quel que soit le chemin d'écriture (API, admin, import), un administrateur porte « admin » et
-- personne d'autre ne peut le porter.
create or replace function public.enforce_admin_border() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.role = 'admin' then
    new.equipped_border := 'admin';
  elsif new.equipped_border in ('admin', 'border-admin') then
    new.equipped_border := 'none';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_admin_border on public.users;
create trigger trg_enforce_admin_border
  before insert or update of role, equipped_border on public.users
  for each row execute function public.enforce_admin_border();

update public.users set equipped_border = 'admin' where role = 'admin' and equipped_border is distinct from 'admin';
update public.users set equipped_border = 'none' where role <> 'admin' and equipped_border in ('admin', 'border-admin');
