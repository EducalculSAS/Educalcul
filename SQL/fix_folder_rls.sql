-- Enable RLS and allow all operations for folder tables
-- Run this script in your Supabase SQL Editor to fix the "row-level security policy" error

-- Course Folders
ALTER TABLE public.course_folders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to course_folders" ON public.course_folders;
CREATE POLICY "Allow full access to course_folders" ON public.course_folders FOR ALL USING (true) WITH CHECK (true);

-- Exercise Folders
ALTER TABLE public.exercise_folders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to exercise_folders" ON public.exercise_folders;
CREATE POLICY "Allow full access to exercise_folders" ON public.exercise_folders FOR ALL USING (true) WITH CHECK (true);

-- Quiz Folders
ALTER TABLE public.quiz_folders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to quiz_folders" ON public.quiz_folders;
CREATE POLICY "Allow full access to quiz_folders" ON public.quiz_folders FOR ALL USING (true) WITH CHECK (true);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
