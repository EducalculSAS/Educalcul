-- Fix RLS Policy to allow Users to update their own profile

-- 1. Allow users to update their own profile based on auth_id
-- This is necessary because the default "Enable update for users based on email" or similar might not cover auth_id checks correctly if not set up.
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
USING (auth.uid() = auth_id)
WITH CHECK (auth.uid() = auth_id);

-- 2. Allow parents to update their children (e.g. change name, avatar)
CREATE POLICY "Parents can update their children"
ON public.users
FOR UPDATE
USING (
  parent_id IN (
    SELECT id FROM public.users WHERE auth_id = auth.uid()
  )
)
WITH CHECK (
  parent_id IN (
    SELECT id FROM public.users WHERE auth_id = auth.uid()
  )
);
