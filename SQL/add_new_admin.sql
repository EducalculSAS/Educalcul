-- Script pour ajouter un nouveau compte admin (Compatible PostgreSQL / Supabase)
-- Ce script crée l'utilisateur dans le système d'authentification (auth.users)
-- Le trigger existant créera automatiquement l'entrée correspondante dans public.users
-- Mot de passe par défaut : password

INSERT INTO auth.users (
    instance_id,
    id,
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
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'nouveau_admin@educalcul.com',
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- Hash pour 'password'
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"role": "admin", "first_name": "Nouveau", "last_name": "Admin"}',
    now(),
    now(),
    '',
    ''
);

-- Note : Si vous ne pouvez pas écrire dans auth.users (permission denied),
-- vous devrez créer l'utilisateur via le tableau de bord Supabase (Authentication > Add User)
-- avec l'email 'nouveau_admin@educalcul.com' et le mot de passe de votre choix.
