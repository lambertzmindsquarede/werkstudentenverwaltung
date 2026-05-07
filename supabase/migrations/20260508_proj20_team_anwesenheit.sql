-- PROJ-20: Team-Anwesenheitsübersicht
-- Creates sub_locations + daily_presence tables; adds visibility to bereiche

-- ─── 1. Add visibility to bereiche ───────────────────────────────────────────
ALTER TABLE bereiche
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'team'
  CHECK (visibility IN ('team', 'global'));

-- ─── 2. sub_locations table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sub_locations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  arbeitsort_id UUID        NOT NULL REFERENCES arbeitsorte(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 50),
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate active names per arbeitsort
CREATE UNIQUE INDEX IF NOT EXISTS uq_sub_locations_arbeitsort_name_active
  ON sub_locations(arbeitsort_id, name)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sub_locations_arbeitsort_id
  ON sub_locations(arbeitsort_id);

-- ─── 3. daily_presence table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_presence (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date             DATE        NOT NULL,
  sub_location_id  UUID        REFERENCES sub_locations(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_presence_user_date
  ON daily_presence(user_id, date);

CREATE INDEX IF NOT EXISTS idx_daily_presence_date
  ON daily_presence(date);

-- ─── 4. RLS for sub_locations ─────────────────────────────────────────────────
ALTER TABLE sub_locations ENABLE ROW LEVEL SECURITY;

-- Manager: full access to sub_locations of own arbeitsorte
CREATE POLICY "proj20_manager_all_sub_locations"
  ON sub_locations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM arbeitsorte a
      WHERE a.id = sub_locations.arbeitsort_id
        AND a.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM arbeitsorte a
      WHERE a.id = sub_locations.arbeitsort_id
        AND a.manager_id = auth.uid()
    )
  );

-- Werkstudent: read sub_locations belonging to their manager's arbeitsorte
CREATE POLICY "proj20_werkstudent_select_sub_locations"
  ON sub_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM arbeitsorte a
      JOIN profiles p ON p.manager_id = a.manager_id
      WHERE a.id = sub_locations.arbeitsort_id
        AND p.id = auth.uid()
    )
  );

-- ─── 5. RLS for daily_presence ────────────────────────────────────────────────
ALTER TABLE daily_presence ENABLE ROW LEVEL SECURITY;

-- Users write only their own entry
CREATE POLICY "proj20_self_insert_presence"
  ON daily_presence FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "proj20_self_update_presence"
  ON daily_presence FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "proj20_self_delete_presence"
  ON daily_presence FOR DELETE
  USING (user_id = auth.uid());

-- Users read own team's presence (same bereich via profiles.bereich_id)
CREATE POLICY "proj20_team_select_presence"
  ON daily_presence FOR SELECT
  USING (
    -- own entry always readable
    user_id = auth.uid()
    OR
    -- same bereich
    EXISTS (
      SELECT 1 FROM profiles p_other
      JOIN profiles p_self ON p_self.id = auth.uid()
      WHERE p_other.id = daily_presence.user_id
        AND p_other.bereich_id = p_self.bereich_id
        AND p_other.bereich_id IS NOT NULL
    )
    OR
    -- global visibility bereiche: visible to all authenticated users
    EXISTS (
      SELECT 1 FROM profiles p_other
      JOIN bereiche b ON b.id = p_other.bereich_id
      WHERE p_other.id = daily_presence.user_id
        AND b.visibility = 'global'
    )
  );
