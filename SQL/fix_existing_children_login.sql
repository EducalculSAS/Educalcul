-- SQL Script to enforce Username Login consistency for Children
-- This script ensures that 'child' users have a valid username and that it is unique.

-- 1. Ensure child_username is unique for active users (to prevent login collisions)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_child_username 
ON public.users (child_username) 
WHERE role = 'child' AND status = 'active';

-- 2. Constraint: Children MUST have a username
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS check_child_username_presence;

ALTER TABLE public.users 
ADD CONSTRAINT check_child_username_presence 
CHECK (
  (role = 'child' AND child_username IS NOT NULL AND length(child_username) > 0)
  OR 
  (role != 'child')
);

-- 3. Diagnostic Query: Find children who are missing an Auth ID (cannot log in)
-- You can run this to see which children need the "Auto-healing" login to trigger.
SELECT 
    id, 
    first_name, 
    last_name, 
    child_username, 
    parent_id 
FROM 
    public.users 
WHERE 
    role = 'child' 
    AND (auth_id IS NULL OR auth_id::text = '');

-- Note: The actual creation of auth.users entries is handled by the 
-- application's "Self-Healing" login mechanism (api/auth/login-helper)
-- which creates the auth user on-the-fly when a child tries to log in 
-- with their username and the correct password.
