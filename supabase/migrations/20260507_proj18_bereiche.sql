-- PROJ-18: Admin-Rolle & Bereichsverwaltung
-- Adds bereiche + bereich_manager tables, extends profiles with is_admin + bereich_id

-- ─── 1. Extend profiles ───────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bereich_id UUID;

CREATE INDEX IF NOT EXISTS idx_profiles_bereich_id ON profiles(bereich_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;

-- ─── 2. bereiche table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bereiche (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL UNIQUE CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. FK profiles → bereiche (added after table creation) ──────────────────
DO $$
BEGIN
  ALTER TABLE profiles
    ADD CONSTRAINT fk_profiles_bereich
    FOREIGN KEY (bereich_id) REFERENCES bereiche(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

-- ─── 4. bereich_manager join table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bereich_manager (
  bereich_id UUID NOT NULL REFERENCES bereiche(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (bereich_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bereich_manager_user_id    ON bereich_manager(user_id);
CREATE INDEX IF NOT EXISTS idx_bereich_manager_bereich_id ON bereich_manager(bereich_id);

-- ─── 5. RLS for bereiche ──────────────────────────────────────────────────────
ALTER TABLE bereiche ENABLE ROW LEVEL SECURITY;

-- Admin: full CRUD
CREATE POLICY "proj18_admin_all_bereiche"
  ON bereiche FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Manager: read-only (to show bereich names in their UI)
CREATE POLICY "proj18_manager_select_bereiche"
  ON bereiche FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );

-- Werkstudent: read only their own bereich
CREATE POLICY "proj18_werkstudent_select_own_bereich"
  ON bereiche FOR SELECT
  USING (
    id = (SELECT bereich_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

-- ─── 6. RLS for bereich_manager ───────────────────────────────────────────────
ALTER TABLE bereich_manager ENABLE ROW LEVEL SECURITY;

-- Admin: full CRUD
CREATE POLICY "proj18_admin_all_bereich_manager"
  ON bereich_manager FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Manager: read own assignments (to know which bereiche they manage)
CREATE POLICY "proj18_manager_select_own_bereich_manager"
  ON bereich_manager FOR SELECT
  USING (user_id = auth.uid());

-- Werkstudent: read manager-assignments of their bereich (to know who their manager is)
CREATE POLICY "proj18_werkstudent_select_bereich_manager"
  ON bereich_manager FOR SELECT
  USING (
    bereich_id = (SELECT bereich_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

-- ─── 7. Seeding: "Standard" Bereich + assign all existing profiles ─────────────
INSERT INTO bereiche (name)
VALUES ('Standard')
ON CONFLICT (name) DO NOTHING;

UPDATE profiles
SET bereich_id = (SELECT id FROM bereiche WHERE name = 'Standard')
WHERE bereich_id IS NULL;
