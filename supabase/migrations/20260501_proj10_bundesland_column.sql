ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bundesland VARCHAR(2) NOT NULL DEFAULT 'NW';

COMMENT ON COLUMN public.profiles.bundesland IS 'ISO-3166-2 Bundesland-Kürzel (NW, BY, BE, …) für Feiertagsberechnung';
