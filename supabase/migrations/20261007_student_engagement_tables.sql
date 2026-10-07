-- Appliquée sur le projet Educalcul le 2026-10-07 (migration student_engagement_tables).
-- Objectifs, carnet d'erreurs, alertes : vraies tables (liées à users, supprimées avec le compte), fermées au navigateur.

create table public.student_prefs (
  user_id bigint primary key references public.users(id) on delete cascade,
  daily_goal smallint not null default 2 check (daily_goal between 1 and 8),
  weekly_target smallint check (weekly_target between 1 and 60),
  quiet_enabled boolean not null default false,
  quiet_start text not null default '21:00' check (quiet_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  quiet_end text not null default '07:00' check (quiet_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  quiet_override_until timestamptz,
  exam_date date,
  updated_at timestamptz not null default now()
);

create table public.student_meta (
  user_id bigint primary key references public.users(id) on delete cascade,
  srs_mastered integer not null default 0,
  share_version integer not null default 1,
  alert_goal_day date,
  alert_weekly_target_week date,
  alert_streak_milestone smallint not null default 0,
  alert_inactive_since date,
  updated_at timestamptz not null default now()
);

create table public.srs_items (
  user_id bigint not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('exercise', 'quiz')),
  ref text not null,
  block text not null,
  box smallint not null default 0 check (box between 0 and 4),
  due date not null,
  misses integer not null default 1,
  last_day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, ref, block)
);
create index srs_items_due_idx on public.srs_items (user_id, due);

create table public.student_review_days (
  user_id bigint not null references public.users(id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);

create table public.parent_alert_prefs (
  user_id bigint primary key references public.users(id) on delete cascade,
  inactivity boolean not null default true,
  inactivity_days smallint not null default 4 check (inactivity_days between 2 and 30),
  chapter boolean not null default true,
  goals boolean not null default true,
  email boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.student_prefs enable row level security;
alter table public.student_meta enable row level security;
alter table public.srs_items enable row level security;
alter table public.student_review_days enable row level security;
alter table public.parent_alert_prefs enable row level security;

revoke all on public.student_prefs, public.student_meta, public.srs_items, public.student_review_days, public.parent_alert_prefs from anon, authenticated;
grant all on public.student_prefs, public.student_meta, public.srs_items, public.student_review_days, public.parent_alert_prefs to service_role;

create or replace function public.bump_review_day(p_user bigint, p_day date, p_n integer)
returns void language sql set search_path = public as $$
  insert into public.student_review_days (user_id, day, count) values (p_user, p_day, p_n)
  on conflict (user_id, day) do update set count = public.student_review_days.count + excluded.count;
$$;

create or replace function public.bump_srs_mastered(p_user bigint, p_n integer)
returns void language sql set search_path = public as $$
  insert into public.student_meta (user_id, srs_mastered) values (p_user, p_n)
  on conflict (user_id) do update set srs_mastered = public.student_meta.srs_mastered + excluded.srs_mastered, updated_at = now();
$$;

revoke execute on function public.bump_review_day(bigint, date, integer), public.bump_srs_mastered(bigint, integer) from public, anon, authenticated;
grant execute on function public.bump_review_day(bigint, date, integer), public.bump_srs_mastered(bigint, integer) to service_role;

-- Ancien stockage provisoire (app_settings) : nettoyé.
delete from public.app_settings where key like 'u:%';
