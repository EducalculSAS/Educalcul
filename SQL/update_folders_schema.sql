-- Add hierarchy support and status to folder tables
-- Run this script in your Supabase SQL Editor

-- Course Folders
ALTER TABLE public.course_folders 
ADD COLUMN IF NOT EXISTS parent_id bigint REFERENCES public.course_folders(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';

-- Exercise Folders
ALTER TABLE public.exercise_folders 
ADD COLUMN IF NOT EXISTS parent_id bigint REFERENCES public.exercise_folders(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';

-- Quiz Folders
ALTER TABLE public.quiz_folders 
ADD COLUMN IF NOT EXISTS parent_id bigint REFERENCES public.quiz_folders(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
