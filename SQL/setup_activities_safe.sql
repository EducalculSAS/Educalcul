-- Final Safe SQL Migration for Activity Tracking
-- This script avoids DROP TABLE CASCADE to prevent breaking existing views like 'view_user_global_stats'.
-- It ensures tables have the correct columns and implements flexible RLS policies.

-- 1. Ensure Tables exist
CREATE TABLE IF NOT EXISTS public.user_course_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_id BIGINT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    chapter_index INTEGER NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, course_id, chapter_index)
);

CREATE TABLE IF NOT EXISTS public.user_exercise_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    exercise_id BIGINT NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    total_points INTEGER NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    quiz_id BIGINT NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    total_points INTEGER NOT NULL,
    time_spent_seconds INTEGER NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable RLS
ALTER TABLE public.user_course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exercise_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- 3. Update RLS Policies (Handles UUID vs BIGINT join)
DROP POLICY IF EXISTS "Users can view own course progress" ON public.user_course_progress;
CREATE POLICY "Users can view own course progress" ON public.user_course_progress FOR SELECT USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert own course progress" ON public.user_course_progress;
CREATE POLICY "Users can insert own course progress" ON public.user_course_progress FOR INSERT WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view own exercise attempts" ON public.user_exercise_attempts;
CREATE POLICY "Users can view own exercise attempts" ON public.user_exercise_attempts FOR SELECT USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert own exercise attempts" ON public.user_exercise_attempts;
CREATE POLICY "Users can insert own exercise attempts" ON public.user_exercise_attempts FOR INSERT WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view own quiz attempts" ON public.user_quiz_attempts;
CREATE POLICY "Users can view own quiz attempts" ON public.user_quiz_attempts FOR SELECT USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert own quiz attempts" ON public.user_quiz_attempts;
CREATE POLICY "Users can insert own quiz attempts" ON public.user_quiz_attempts FOR INSERT WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));
