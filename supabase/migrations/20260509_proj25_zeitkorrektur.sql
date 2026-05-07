-- PROJ-25: Manager-Zeitkorrektur
-- Adds status/correction fields to actual_entries and creates time_entry_corrections audit log

-- 1. Extend actual_entries with correction metadata
ALTER TABLE actual_entries
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved')),
  ADD COLUMN IF NOT EXISTS corrected_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS corrected_at timestamptz,
  ADD COLUMN IF NOT EXISTS correction_note text;

-- Ensure all existing rows have status = 'draft' (already the default, but explicit)
UPDATE actual_entries SET status = 'draft' WHERE status IS NULL;

-- 2. Create audit log table
CREATE TABLE IF NOT EXISTS time_entry_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid REFERENCES actual_entries(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('edit', 'create', 'delete')),
  manager_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  corrected_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  old_start time,
  old_end time,
  new_start time,
  new_end time,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. RLS for time_entry_corrections
ALTER TABLE time_entry_corrections ENABLE ROW LEVEL SECURITY;

-- Managers can insert corrections (append-only; no updates or deletes)
CREATE POLICY "managers_insert_corrections" ON time_entry_corrections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    manager_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'manager' OR is_admin = true)
    )
  );

-- Managers can read corrections for entries in their bereich
CREATE POLICY "managers_read_corrections" ON time_entry_corrections
  FOR SELECT
  TO authenticated
  USING (
    manager_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Werkstudenten can read corrections on their own entries
CREATE POLICY "werkstudenten_read_own_corrections" ON time_entry_corrections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM actual_entries ae
      WHERE ae.id = time_entry_id
        AND ae.user_id = auth.uid()
    )
  );
