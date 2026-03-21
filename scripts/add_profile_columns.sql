-- Add missing profile customization columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_border TEXT DEFAULT 'none';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name_animation TEXT DEFAULT 'none';

-- Ensure child_username is indexed for faster lookup in forum
CREATE INDEX IF NOT EXISTS idx_users_child_username ON public.users(child_username);
