-- Heure de début de la tentative en cours : sert à tenir le temps limité (exercices et quiz chronométrés) côté serveur.
alter table public.user_exercise_attempts add column if not exists attempt_started_at timestamptz;
alter table public.user_quiz_attempts add column if not exists attempt_started_at timestamptz;
