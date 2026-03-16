-- Ajout de colonnes pour la géolocalisation et le suivi avancé
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_login_ip TEXT,
ADD COLUMN IF NOT EXISTS last_login_city TEXT,
ADD COLUMN IF NOT EXISTS last_login_country TEXT,
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS device_type TEXT,
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Index pour la performance des recherches par localisation
CREATE INDEX IF NOT EXISTS idx_users_location ON public.users(last_login_country, last_login_city);
