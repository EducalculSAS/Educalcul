-- Ajout de la colonne child_age si elle n'existe pas
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS child_age text;

-- Fonction pour gérer automatiquement les nouveaux utilisateurs
-- Cette fonction est déclenchée chaque fois qu'un utilisateur s'inscrit via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  found_parent_id bigint;
BEGIN
  -- Si un email parent est fourni (cas enfant), on essaie de trouver l'ID du parent
  IF new.raw_user_meta_data->>'parent_email' IS NOT NULL THEN
    SELECT id INTO found_parent_id 
    FROM public.users 
    WHERE email = (new.raw_user_meta_data->>'parent_email')::text;
  END IF;

  INSERT INTO public.users (
    auth_id,
    email,
    first_name,
    last_name,
    role,
    child_username,
    child_age,
    parent_id,
    status
  )
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    (new.raw_user_meta_data->>'role')::text,
    new.raw_user_meta_data->>'child_username',
    (new.raw_user_meta_data->>'child_age')::text,
    found_parent_id,
    'active'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Création du trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
