-- PROJ-22: Add personalnummer field to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS personalnummer TEXT;
