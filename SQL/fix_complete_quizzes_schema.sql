-- Script complet pour réparer la table quizzes et le cache de schéma
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Ajouter la colonne 'type' si elle manque
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS type text DEFAULT 'standard';

-- 2. Ajouter les autres colonnes manquantes
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS difficulty_level text DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS max_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS grading_type text DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS ai_generated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS user_prompt text,
ADD COLUMN IF NOT EXISTS grading_rubric jsonb;

-- 3. Forcer le rechargement du cache de schéma (Indispensable pour l'erreur "Could not find ... in the schema cache")
NOTIFY pgrst, 'reload config';
