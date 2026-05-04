-- Dev-only Seed-Daten für lokalen Login
-- NUR in lokaler Supabase-Instanz ausführen! Niemals in Production!
-- Idempotent: kann mehrfach ausgeführt werden (ON CONFLICT DO UPDATE/NOTHING)

-- ============================================================
-- 1. AUTH USERS
-- ============================================================

-- Dev Admin (Manager) — mit Passwort für Fallback
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
  'authenticated', 'authenticated',
  'dev-admin@mindsquare.de',
  crypt('dev-admin-2026', gen_salt('bf', 10)),
  now(), null, '', null, '', null, '', '',
  null, null,
  '{"provider": "email", "providers": ["email"]}', '{}',
  false, now(), now(), null, null,
  '', '', null, '', 0, '', false, null
)
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = crypt('dev-admin-2026', gen_salt('bf', 10)),
  email_confirmed_at = now();

-- Anna Müller (Werkstudentin)
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
  '00000000-0000-0000-0000-000000000002',
  'authenticated', 'authenticated',
  'anna.mueller@mindsquare.de',
  crypt(gen_random_uuid()::text, gen_salt('bf', 10)),
  now(), null, '', null, '', null, '', '',
  null, null,
  '{"provider": "email", "providers": ["email"]}', '{}',
  false, now(), now(), null, null,
  '', '', null, '', 0, '', false, null
)
ON CONFLICT (id) DO UPDATE SET
  email_confirmed_at = now();

-- Ben Schneider (Werkstudent)
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
  '00000000-0000-0000-0000-000000000003',
  'authenticated', 'authenticated',
  'ben.schneider@mindsquare.de',
  crypt(gen_random_uuid()::text, gen_salt('bf', 10)),
  now(), null, '', null, '', null, '', '',
  null, null,
  '{"provider": "email", "providers": ["email"]}', '{}',
  false, now(), now(), null, null,
  '', '', null, '', 0, '', false, null
)
ON CONFLICT (id) DO UPDATE SET
  email_confirmed_at = now();

-- Clara Fischer (Werkstudentin) — leeres Konto
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
  '00000000-0000-0000-0000-000000000004',
  'authenticated', 'authenticated',
  'clara.fischer@mindsquare.de',
  crypt(gen_random_uuid()::text, gen_salt('bf', 10)),
  now(), null, '', null, '', null, '', '',
  null, null,
  '{"provider": "email", "providers": ["email"]}', '{}',
  false, now(), now(), null, null,
  '', '', null, '', 0, '', false, null
)
ON CONFLICT (id) DO UPDATE SET
  email_confirmed_at = now();

-- ============================================================
-- 2. PROFILE EINTRÄGE
-- ============================================================

INSERT INTO public.profiles (id, email, full_name, role, is_active, bundesland, created_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'dev-admin@mindsquare.de',
    'Dev Admin',
    'manager',
    true,
    'NW',
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'anna.mueller@mindsquare.de',
    'Anna Müller',
    'werkstudent',
    true,
    'NW',
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'ben.schneider@mindsquare.de',
    'Ben Schneider',
    'werkstudent',
    true,
    'BY',
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'clara.fischer@mindsquare.de',
    'Clara Fischer',
    'werkstudent',
    true,
    'NW',
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  role        = EXCLUDED.role,
  is_active   = true,
  bundesland  = EXCLUDED.bundesland;

-- ============================================================
-- 3. PLANNED ENTRIES — Anna Müller (Mo–Fr aktuelle Woche, 09:00–13:00)
-- ============================================================

INSERT INTO public.planned_entries (id, user_id, date, planned_start, planned_end, block_index, created_at, updated_at)
VALUES
  (
    '11000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    date_trunc('week', CURRENT_DATE)::date,         -- Montag
    '09:00', '13:00', 1, now(), now()
  ),
  (
    '11000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    date_trunc('week', CURRENT_DATE)::date + 1,     -- Dienstag
    '09:00', '13:00', 1, now(), now()
  ),
  (
    '11000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    date_trunc('week', CURRENT_DATE)::date + 2,     -- Mittwoch
    '09:00', '13:00', 1, now(), now()
  ),
  (
    '11000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000002',
    date_trunc('week', CURRENT_DATE)::date + 3,     -- Donnerstag
    '09:00', '13:00', 1, now(), now()
  ),
  (
    '11000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000002',
    date_trunc('week', CURRENT_DATE)::date + 4,     -- Freitag
    '09:00', '13:00', 1, now(), now()
  )
ON CONFLICT (id) DO UPDATE SET
  planned_start = EXCLUDED.planned_start,
  planned_end   = EXCLUDED.planned_end,
  updated_at    = now();

-- ============================================================
-- 4. ACTUAL ENTRIES — Anna Müller (Mo–Mi abgeschlossen, 09:00–13:00)
-- ============================================================

INSERT INTO public.actual_entries (id, user_id, date, actual_start, actual_end, is_complete, block_index, break_minutes, created_at, updated_at)
VALUES
  (
    '22000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    date_trunc('week', CURRENT_DATE)::date,         -- Montag
    '09:00', '13:00', true, 1, 0, now(), now()
  ),
  (
    '22000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    date_trunc('week', CURRENT_DATE)::date + 1,     -- Dienstag
    '09:00', '13:00', true, 1, 0, now(), now()
  ),
  (
    '22000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    date_trunc('week', CURRENT_DATE)::date + 2,     -- Mittwoch
    '09:00', '13:00', true, 1, 0, now(), now()
  )
ON CONFLICT (id) DO UPDATE SET
  actual_start  = EXCLUDED.actual_start,
  actual_end    = EXCLUDED.actual_end,
  is_complete   = EXCLUDED.is_complete,
  updated_at    = now();

-- ============================================================
-- 5. ACTUAL ENTRY — Ben Schneider (heute, laufender Stempel)
-- ============================================================

INSERT INTO public.actual_entries (id, user_id, date, actual_start, actual_end, is_complete, block_index, break_minutes, created_at, updated_at)
VALUES
  (
    '33000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000003',
    CURRENT_DATE,
    '09:00', null, false, 1, 0, now(), now()
  )
ON CONFLICT (id) DO UPDATE SET
  actual_start = EXCLUDED.actual_start,
  actual_end   = null,
  is_complete  = false,
  updated_at   = now();

-- Clara Fischer: keine Einträge (frisches Konto)
