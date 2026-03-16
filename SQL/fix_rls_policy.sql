-- Fix RLS Policy to allow Parents to add Children

-- 1. Drop the existing insert policy if it exists (to avoid conflicts if we are replacing it, though the default one is different)
-- The default policy "Enable insert for authentication" only allows inserting your OWN profile (auth.uid() = auth_id).
-- We need an additional policy for parents adding children.

-- 2. Create the new policy
CREATE POLICY "Parents can insert children"
ON public.users FOR INSERT
WITH CHECK (
  -- The new user must have role 'child'
  role = 'child' 
  AND 
  -- The parent_id must match the ID of the currently authenticated user
  parent_id IN (
    SELECT id FROM public.users WHERE auth_id = auth.uid()
  )
);

-- Note: This requires the 'get_my_user_id()' function or the subquery above.
-- If get_my_user_id() exists, you can use: parent_id = get_my_user_id()
