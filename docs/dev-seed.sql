-- Dev-only Admin-User für PROJ-7 lokalen Login
-- NUR in lokaler Supabase-Instanz ausführen! Niemals in Production!

-- 1. Auth-User anlegen (wird für generateLink / magiclink-Flow benötigt)
INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'dev-admin@mindsquare.de',
  now(), now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- 2. Profil anlegen (profiles-Tabelle, konsistent mit PROJ-1 Auth-Flow)
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
