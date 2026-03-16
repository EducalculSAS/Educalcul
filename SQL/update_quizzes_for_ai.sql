-- Update Quizzes Table for AI and specific parameters
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS difficulty_level text CHECK (difficulty_level IN ('easy', 'medium', 'hard', 'expert')),
ADD COLUMN IF NOT EXISTS max_attempts integer DEFAULT 0, -- 0 means unlimited
ADD COLUMN IF NOT EXISTS grading_type text DEFAULT 'auto', -- 'auto', 'ai', 'manual'
ADD COLUMN IF NOT EXISTS ai_generated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS user_prompt text;

-- Ensure grading_rubric exists (it was in update_exercises_for_ai.sql but good to double check)
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS grading_rubric jsonb;
