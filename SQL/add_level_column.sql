-- Ajouter la colonne 'level' aux tables principales
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Table Courses
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS level text;

-- 2. Table Exercises
ALTER TABLE public.exercises 
ADD COLUMN IF NOT EXISTS level text;

-- 3. Table Quizzes
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS level text;

-- 4. Recharger le cache de schéma
NOTIFY pgrst, 'reload config';
