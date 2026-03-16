-- Fix infinite recursion in "Parents can view their children" policy

-- 1. Create a helper function to get internal ID from auth ID
-- SECURITY DEFINER ensures this runs with admin privileges, bypassing RLS
CREATE OR REPLACE FUNCTION get_my_user_id()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid();
$$;

-- 2. Drop the problematic policy
DROP POLICY IF EXISTS "Parents can view their children" ON public.users;

-- 3. Re-create the policy using the function
CREATE POLICY "Parents can view their children" 
ON public.users FOR SELECT 
USING (
  parent_id = get_my_user_id()
);
