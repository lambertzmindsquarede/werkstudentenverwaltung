-- PROJ-24: Add absences_enabled flag to bereiche
-- Allows admins to disable the absence feature per Bereich.
-- All existing bereiche default to true (no breaking change).

ALTER TABLE bereiche
  ADD COLUMN IF NOT EXISTS absences_enabled BOOLEAN NOT NULL DEFAULT true;
