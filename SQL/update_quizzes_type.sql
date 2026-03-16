-- Add type and other AI-related columns to quizzes table
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS type text DEFAULT 'standard', -- 'standard', 'exam', 'practice', etc.
ADD COLUMN IF NOT EXISTS difficulty_level text DEFAULT 'medium', -- 'easy', 'medium', 'hard', 'expert'
ADD COLUMN IF NOT EXISTS max_attempts integer DEFAULT 0, -- 0 for unlimited
ADD COLUMN IF NOT EXISTS grading_type text DEFAULT 'auto'; -- 'auto', 'manual', 'mixed'
