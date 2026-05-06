-- PROJ-15: Änderungsbenachrichtigung für Manager
-- Schema: manager_id on profiles + booking_change_log table + triggers

-- ─── 1. manager_id on profiles ───────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON profiles(manager_id);

-- ─── 2. booking_change_log table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_change_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- nullable so the log survives if the source entry is deleted
  entry_id    UUID        REFERENCES actual_entries(id) ON DELETE SET NULL,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date        DATE        NOT NULL,
  field_changed TEXT      NOT NULL CHECK (field_changed IN ('actual_start', 'actual_end', 'break_minutes')),
  old_value   TEXT,
  new_value   TEXT,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bcl_user_id
  ON booking_change_log(user_id);

CREATE INDEX IF NOT EXISTS idx_bcl_pending
  ON booking_change_log(date)
  WHERE notified_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bcl_changed_at
  ON booking_change_log(changed_at);

-- ─── 3. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE booking_change_log ENABLE ROW LEVEL SECURITY;

-- Werkstudenten lesen nur eigene Log-Einträge
CREATE POLICY "werkstudenten_select_own_change_log"
  ON booking_change_log FOR SELECT
  USING (auth.uid() = user_id);

-- Manager lesen Log-Einträge ihrer Werkstudenten
CREATE POLICY "manager_select_team_change_log"
  ON booking_change_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = booking_change_log.user_id
        AND p.manager_id = auth.uid()
    )
  );

-- ─── 4. Trigger function: UPDATE on actual_entries ───────────────────────────
CREATE OR REPLACE FUNCTION log_actual_entry_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_berlin DATE;
BEGIN
  -- Only log changes for past dates (not today or future)
  today_berlin := (NOW() AT TIME ZONE 'Europe/Berlin')::DATE;
  IF OLD.date >= today_berlin THEN
    RETURN NEW;
  END IF;

  IF OLD.actual_start IS DISTINCT FROM NEW.actual_start THEN
    INSERT INTO booking_change_log (entry_id, user_id, date, field_changed, old_value, new_value)
    VALUES (OLD.id, OLD.user_id, OLD.date, 'actual_start',
            OLD.actual_start::TEXT, NEW.actual_start::TEXT);
  END IF;

  IF OLD.actual_end IS DISTINCT FROM NEW.actual_end THEN
    INSERT INTO booking_change_log (entry_id, user_id, date, field_changed, old_value, new_value)
    VALUES (OLD.id, OLD.user_id, OLD.date, 'actual_end',
            OLD.actual_end::TEXT, NEW.actual_end::TEXT);
  END IF;

  IF OLD.break_minutes IS DISTINCT FROM NEW.break_minutes THEN
    INSERT INTO booking_change_log (entry_id, user_id, date, field_changed, old_value, new_value)
    VALUES (OLD.id, OLD.user_id, OLD.date, 'break_minutes',
            OLD.break_minutes::TEXT, NEW.break_minutes::TEXT);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tgr_log_actual_entry_changes ON actual_entries;
CREATE TRIGGER tgr_log_actual_entry_changes
  AFTER UPDATE ON actual_entries
  FOR EACH ROW
  EXECUTE FUNCTION log_actual_entry_changes();

-- ─── 5. Trigger function: DELETE on actual_entries ───────────────────────────
CREATE OR REPLACE FUNCTION log_actual_entry_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_berlin DATE;
BEGIN
  today_berlin := (NOW() AT TIME ZONE 'Europe/Berlin')::DATE;
  IF OLD.date >= today_berlin THEN
    RETURN OLD;
  END IF;

  -- Log deletion of start time
  IF OLD.actual_start IS NOT NULL THEN
    INSERT INTO booking_change_log (entry_id, user_id, date, field_changed, old_value, new_value)
    VALUES (OLD.id, OLD.user_id, OLD.date, 'actual_start', OLD.actual_start::TEXT, '—');
  END IF;

  -- Log deletion of end time
  IF OLD.actual_end IS NOT NULL THEN
    INSERT INTO booking_change_log (entry_id, user_id, date, field_changed, old_value, new_value)
    VALUES (OLD.id, OLD.user_id, OLD.date, 'actual_end', OLD.actual_end::TEXT, '—');
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tgr_log_actual_entry_deletion ON actual_entries;
CREATE TRIGGER tgr_log_actual_entry_deletion
  BEFORE DELETE ON actual_entries
  FOR EACH ROW
  EXECUTE FUNCTION log_actual_entry_deletion();
