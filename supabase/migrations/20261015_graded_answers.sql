-- Verdicts de correction enregistrés côté serveur : la note d'une tentative est la somme de ces lignes,
-- jamais un score déclaré par le navigateur.
create table if not exists public.graded_answers (
  user_id bigint not null,
  kind text not null check (kind in ('exercise', 'quiz')),
  item_id text not null,
  block_id text not null,
  score numeric not null default 0,
  max_score numeric not null default 0,
  is_correct boolean not null default false,
  graded_at timestamptz not null default now(),
  primary key (user_id, kind, item_id, block_id)
);
alter table public.graded_answers enable row level security;
