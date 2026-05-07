-- PROJ-19: Bereichs-Datenisolation für Manager
-- Adds SECURITY DEFINER helper functions and replaces the old broad manager
-- policies with bereich-scoped ones so data isolation is enforced at DB level.
--
-- NOTE: This migration was applied directly to Supabase (version 20260507001315)
-- and is committed here retroactively to keep the local migration history in sync.

-- ─── 1. Helper functions (SECURITY DEFINER avoids RLS recursion) ─────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND is_admin = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'manager'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_my_bereich_ids()
RETURNS TABLE(bereich_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT bm.bereich_id
  FROM public.bereich_manager bm
  WHERE bm.user_id = auth.uid()
$$;

-- ─── 2. Drop old overly-broad manager policies ────────────────────────────────

DROP POLICY IF EXISTS "Managers can read all profiles"  ON profiles;
DROP POLICY IF EXISTS "Managers can update all profiles" ON profiles;
DROP POLICY IF EXISTS "manager_read_all_entries"         ON planned_entries;
DROP POLICY IF EXISTS "manager_read_all_actual"          ON actual_entries;

-- ─── 3. New bereich-scoped policies: profiles ─────────────────────────────────

DROP POLICY IF EXISTS proj19_admin_read_profiles           ON profiles;
DROP POLICY IF EXISTS proj19_admin_update_profiles         ON profiles;
DROP POLICY IF EXISTS proj19_manager_read_bereich_profiles ON profiles;
DROP POLICY IF EXISTS proj19_manager_read_manager_profiles ON profiles;
DROP POLICY IF EXISTS proj19_manager_update_bereich_profiles ON profiles;

-- Admin: read all profiles
CREATE POLICY proj19_admin_read_profiles
  ON profiles FOR SELECT
  USING (is_admin());

-- Admin: update all profiles
CREATE POLICY proj19_admin_update_profiles
  ON profiles FOR UPDATE
  USING (is_admin());

-- Manager (non-admin): read only werkstudenten in own bereiche
CREATE POLICY proj19_manager_read_bereich_profiles
  ON profiles FOR SELECT
  USING (
    NOT is_admin()
    AND is_manager()
    AND bereich_id IN (SELECT get_my_bereich_ids.bereich_id FROM get_my_bereich_ids())
  );

-- Manager: also read other manager profiles (for dropdowns/assignments)
CREATE POLICY proj19_manager_read_manager_profiles
  ON profiles FOR SELECT
  USING (
    is_manager()
    AND role = 'manager'
  );

-- Manager (non-admin): update only profiles in own bereiche
CREATE POLICY proj19_manager_update_bereich_profiles
  ON profiles FOR UPDATE
  USING (
    NOT is_admin()
    AND is_manager()
    AND bereich_id IN (SELECT get_my_bereich_ids.bereich_id FROM get_my_bereich_ids())
  );

-- ─── 4. New bereich-scoped policies: planned_entries ─────────────────────────

DROP POLICY IF EXISTS proj19_admin_read_planned           ON planned_entries;
DROP POLICY IF EXISTS proj19_manager_read_bereich_planned ON planned_entries;

-- Admin: read all planned entries
CREATE POLICY proj19_admin_read_planned
  ON planned_entries FOR SELECT
  USING (is_admin());

-- Manager (non-admin): read only entries whose user_id is in own bereiche
CREATE POLICY proj19_manager_read_bereich_planned
  ON planned_entries FOR SELECT
  USING (
    NOT is_admin()
    AND is_manager()
    AND user_id IN (
      SELECT p.id FROM profiles p
      WHERE p.bereich_id IN (SELECT get_my_bereich_ids.bereich_id FROM get_my_bereich_ids())
    )
  );

-- ─── 5. New bereich-scoped policies: actual_entries ──────────────────────────

DROP POLICY IF EXISTS proj19_admin_read_actual           ON actual_entries;
DROP POLICY IF EXISTS proj19_manager_read_bereich_actual ON actual_entries;

-- Admin: read all actual entries
CREATE POLICY proj19_admin_read_actual
  ON actual_entries FOR SELECT
  USING (is_admin());

-- Manager (non-admin): read only entries whose user_id is in own bereiche
CREATE POLICY proj19_manager_read_bereich_actual
  ON actual_entries FOR SELECT
  USING (
    NOT is_admin()
    AND is_manager()
    AND user_id IN (
      SELECT p.id FROM profiles p
      WHERE p.bereich_id IN (SELECT get_my_bereich_ids.bereich_id FROM get_my_bereich_ids())
    )
  );
