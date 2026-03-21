-- 1. Drop the blocking view if it exists
DROP VIEW IF EXISTS public.view_user_global_stats CASCADE;

-- 2. Drop old tables safely that had the wrong schema or lacked UNIQUE constraints
DROP TABLE IF EXISTS public.user_course_progress CASCADE;
DROP TABLE IF EXISTS public.user_exercise_attempts CASCADE;
DROP TABLE IF EXISTS public.user_quiz_attempts CASCADE;

-- 3. Recreate the tables correctly WITH `status` and `UNIQUE` constraints
CREATE TABLE public.user_course_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_id BIGINT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    chapter_index INTEGER NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'in_progress',
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, course_id)
);

CREATE TABLE public.user_exercise_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    exercise_id BIGINT NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    total_points INTEGER NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'in_progress',
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, exercise_id)
);

CREATE TABLE public.user_quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    quiz_id BIGINT NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    total_points INTEGER NOT NULL,
    time_spent_seconds INTEGER NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'in_progress',
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, quiz_id)
);

-- 4. Enable RLS
ALTER TABLE public.user_course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exercise_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- 5. Add proper RLS Policies mapping BIGINT user_id to UUID auth.uid()
CREATE POLICY "Users can view own course progress" ON public.user_course_progress 
FOR SELECT USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can insert own course progress" ON public.user_course_progress 
FOR INSERT WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can update own course progress" ON public.user_course_progress 
FOR UPDATE USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can view own exercise attempts" ON public.user_exercise_attempts 
FOR SELECT USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can insert own exercise attempts" ON public.user_exercise_attempts 
FOR INSERT WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can update own exercise attempts" ON public.user_exercise_attempts 
FOR UPDATE USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can view own quiz attempts" ON public.user_quiz_attempts 
FOR SELECT USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can insert own quiz attempts" ON public.user_quiz_attempts 
FOR INSERT WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can update own quiz attempts" ON public.user_quiz_attempts 
FOR UPDATE USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));
