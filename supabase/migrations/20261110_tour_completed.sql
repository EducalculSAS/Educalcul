-- Tutoriel guidé de première visite (src/components/tour/GuidedTour.tsx) : terminé ou quitté.
alter table public.users add column if not exists tour_completed boolean not null default false;
