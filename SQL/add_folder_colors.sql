-- Add color column to course_folders if it doesn't exist
ALTER TABLE public.course_folders 
ADD COLUMN IF NOT EXISTS color text DEFAULT '#3b82f6';

-- Ensure other tables have it too (they should, but good to double check)
ALTER TABLE public.exercise_folders 
ADD COLUMN IF NOT EXISTS color text DEFAULT '#3b82f6';

ALTER TABLE public.quiz_folders 
ADD COLUMN IF NOT EXISTS color text DEFAULT '#3b82f6';

NOTIFY pgrst, 'reload schema';
