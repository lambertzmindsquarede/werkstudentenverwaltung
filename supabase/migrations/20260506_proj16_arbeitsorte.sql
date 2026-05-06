-- PROJ-16: Arbeitsort-Auswahl
-- Creates arbeitsorte table + adds arbeitsort_id FK to planned_entries

-- ─── 1. arbeitsorte table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS arbeitsorte (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate active names per manager
CREATE UNIQUE INDEX IF NOT EXISTS uq_arbeitsorte_manager_name_active
  ON arbeitsorte(manager_id, name)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_arbeitsorte_manager_id
  ON arbeitsorte(manager_id);

-- ─── 2. RLS for arbeitsorte ───────────────────────────────────────────────────
ALTER TABLE arbeitsorte ENABLE ROW LEVEL SECURITY;

-- Manager: full access to own arbeitsorte
CREATE POLICY "manager_select_own_arbeitsorte"
  ON arbeitsorte FOR SELECT
  USING (auth.uid() = manager_id);

CREATE POLICY "manager_insert_own_arbeitsorte"
  ON arbeitsorte FOR INSERT
  WITH CHECK (auth.uid() = manager_id);

CREATE POLICY "manager_update_own_arbeitsorte"
  ON arbeitsorte FOR UPDATE
  USING (auth.uid() = manager_id)
  WITH CHECK (auth.uid() = manager_id);

-- Werkstudent: read arbeitsorte of their assigned manager
CREATE POLICY "werkstudent_select_manager_arbeitsorte"
  ON arbeitsorte FOR SELECT
  USING (
    manager_id = (
      SELECT p.manager_id FROM profiles p
      WHERE p.id = auth.uid()
      LIMIT 1
    )
  );

-- ─── 3. arbeitsort_id on planned_entries ─────────────────────────────────────
ALTER TABLE planned_entries
  ADD COLUMN IF NOT EXISTS arbeitsort_id UUID REFERENCES arbeitsorte(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_planned_entries_arbeitsort_id
  ON planned_entries(arbeitsort_id);
