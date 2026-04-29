-- Dev-only Admin-User für lokalen Login
-- NUR in lokaler Supabase-Instanz ausführen! Niemals in Production!

-- 1. Auth-User anlegen (mit Passwort für signInWithPassword-Flow)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
  recovery_token, recovery_sent_at, email_change_token_new, email_change,
  email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
  phone_change, phone_change_token, phone_change_sent_at,
  email_change_token_current, email_change_confirm_status,
  reauthentication_token, is_sso_user, deleted_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'dev-admin@mindsquare.de',
  crypt('dev-admin-2026', gen_salt('bf', 10)),
  now(), null, '', null,
  '', null, '', '',
  null, null,
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  false, now(), now(), null, null,
  '', '', null,
  '', 0,
  '', false, null
)
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = crypt('dev-admin-2026', gen_salt('bf', 10)),
  email_confirmed_at = now();

-- 2. Profil anlegen
INSERT INTO public.profiles (id, email, full_name, role, is_active, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'dev-admin@mindsquare.de',
  'Dev Admin',
  'manager',
  true,
  now()
)
ON CONFLICT (id) DO UPDATE SET
  role = 'manager',
  is_active = true;
