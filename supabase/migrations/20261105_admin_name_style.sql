-- Titre (style du nom) « Égide » : imposé aux administrateurs, interdit à tous les autres comptes, comme le contour.
create or replace function public.enforce_admin_border() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.role = 'admin' then
    new.equipped_border := 'admin';
    new.name_color := 'admin';
  else
    if new.equipped_border in ('admin', 'border-admin') then new.equipped_border := 'none'; end if;
    if new.name_color = 'admin' then new.name_color := 'default'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_admin_border on public.users;
create trigger trg_enforce_admin_border
  before insert or update of role, equipped_border, name_color on public.users
  for each row execute function public.enforce_admin_border();

update public.users set name_color = 'admin' where role = 'admin' and name_color is distinct from 'admin';
update public.users set name_color = 'default' where role <> 'admin' and name_color = 'admin';
