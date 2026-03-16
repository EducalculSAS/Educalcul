
-- Ensure difficulty_level exists in quizzes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quizzes' AND column_name = 'difficulty_level') THEN
        ALTER TABLE public.quizzes ADD COLUMN difficulty_level text CHECK (difficulty_level IN ('easy', 'medium', 'hard', 'expert'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quizzes' AND column_name = 'max_attempts') THEN
        ALTER TABLE public.quizzes ADD COLUMN max_attempts integer DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quizzes' AND column_name = 'grading_type') THEN
        ALTER TABLE public.quizzes ADD COLUMN grading_type text DEFAULT 'auto';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quizzes' AND column_name = 'ai_generated') THEN
        ALTER TABLE public.quizzes ADD COLUMN ai_generated boolean DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quizzes' AND column_name = 'user_prompt') THEN
        ALTER TABLE public.quizzes ADD COLUMN user_prompt text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quizzes' AND column_name = 'grading_rubric') THEN
        ALTER TABLE public.quizzes ADD COLUMN grading_rubric jsonb;
    END IF;
END $$;

-- Force schema cache reload
NOTIFY pgrst, 'reload config';
