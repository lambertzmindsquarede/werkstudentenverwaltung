-- PROJ-8: Mehrere Zeitblöcke pro Tag
-- Adds block_index to planned_entries and actual_entries,
-- replaces the UNIQUE(user_id, date) constraint with UNIQUE(user_id, date, block_index).

-- ─── planned_entries ────────────────────────────────────────────────────────

-- 1. Add block_index column (nullable for safe migration)
ALTER TABLE planned_entries
  ADD COLUMN IF NOT EXISTS block_index integer;

-- 2. Backfill existing rows
UPDATE planned_entries SET block_index = 1 WHERE block_index IS NULL;

-- 3. Enforce NOT NULL
ALTER TABLE planned_entries
  ALTER COLUMN block_index SET NOT NULL;

-- 4. Add CHECK constraint
ALTER TABLE planned_entries
  ADD CONSTRAINT planned_entries_block_index_check
  CHECK (block_index BETWEEN 1 AND 3);

-- 5. Drop old unique constraint
ALTER TABLE planned_entries
  DROP CONSTRAINT IF EXISTS planned_entries_user_id_date_key;

-- 6. Add new unique constraint
ALTER TABLE planned_entries
  ADD CONSTRAINT planned_entries_user_id_date_block_index_key
  UNIQUE (user_id, date, block_index);

-- ─── actual_entries ──────────────────────────────────────────────────────────

-- 1. Add block_index column (nullable for safe migration)
ALTER TABLE actual_entries
  ADD COLUMN IF NOT EXISTS block_index integer;

-- 2. Backfill existing rows
UPDATE actual_entries SET block_index = 1 WHERE block_index IS NULL;

-- 3. Enforce NOT NULL
ALTER TABLE actual_entries
  ALTER COLUMN block_index SET NOT NULL;

-- 4. Add CHECK constraint
ALTER TABLE actual_entries
  ADD CONSTRAINT actual_entries_block_index_check
  CHECK (block_index BETWEEN 1 AND 3);

-- 5. Drop old unique constraint
ALTER TABLE actual_entries
  DROP CONSTRAINT IF EXISTS actual_entries_user_id_date_key;

-- 6. Add new unique constraint
ALTER TABLE actual_entries
  ADD CONSTRAINT actual_entries_user_id_date_block_index_key
  UNIQUE (user_id, date, block_index);
