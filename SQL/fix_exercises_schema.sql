-- Fix exercises table schema

-- Add course_id column with foreign key relationship
ALTER TABLE public.exercises 
ADD COLUMN IF NOT EXISTS course_id bigint REFERENCES public.courses(id) ON DELETE SET NULL;

-- Add question column if it doesn't exist (used by API)
ALTER TABLE public.exercises 
ADD COLUMN IF NOT EXISTS question text;

-- Ensure RLS policies are applied (re-applying or ensuring grants)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises TO authenticated;
GRANT SELECT ON public.exercises TO anon;
