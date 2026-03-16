-- Script de réparation pour le compte admin@educalcul.com
-- Ce script force le hash de mot de passe spécifique et assure la cohérence entre auth.users et public.users

DO $$
DECLARE
  v_user_id uuid;
  v_email text := 'admin@educalcul.com';
  -- Hash fourni par l'utilisateur
  v_hash text := '$2a$06$eh9yqrkzZGzrhsSODcvOI.AnE..uhfO3kHvGxoP36N6Eiti/1mMJC';
BEGIN
  -- 1. Recherche de l'utilisateur dans auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    -- Création de l'utilisateur s'il n'existe pas
    v_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      v_hash,
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{"role": "admin", "first_name": "Admin", "last_name": "Educalcul"}',
      now(),
      now(),
      '',
      ''
    );
    RAISE NOTICE 'Utilisateur auth créé avec ID: %', v_user_id;
  ELSE
    -- Mise à jour de l'utilisateur existant
    UPDATE auth.users
    SET encrypted_password = v_hash,
        updated_at = now(),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', '"admin"')
    WHERE id = v_user_id;
    RAISE NOTICE 'Utilisateur auth mis à jour avec ID: %', v_user_id;
  END IF;

  -- 2. Synchronisation avec public.users
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE email = v_email) THEN
    INSERT INTO public.users (
      auth_id,
      email,
      first_name,
      last_name,
      role,
      status,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      v_email,
      'Admin',
      'Educalcul',
      'admin',
      'active',
      now(),
      now()
    );
    RAISE NOTICE 'Profil public créé';
  ELSE
    -- Mise à jour du profil public pour lier le bon auth_id et assurer le rôle admin
    UPDATE public.users
    SET auth_id = v_user_id,
        role = 'admin',
        status = 'active'
    WHERE email = v_email;
    RAISE NOTICE 'Profil public mis à jour';
  END IF;

END $$;
