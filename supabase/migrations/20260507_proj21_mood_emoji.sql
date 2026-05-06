-- PROJ-21: Stimmungs-Emoji beim Einstempeln
-- Adds mood_emoji column to actual_entries (nullable, cleared on stamp-out)

ALTER TABLE actual_entries
  ADD COLUMN IF NOT EXISTS mood_emoji TEXT NULL
    CHECK (char_length(mood_emoji) <= 10);
