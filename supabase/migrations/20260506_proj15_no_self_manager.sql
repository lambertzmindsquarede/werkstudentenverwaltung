-- PROJ-15: Prevent a profile from being assigned as its own manager
ALTER TABLE profiles
  ADD CONSTRAINT profiles_no_self_manager
  CHECK (manager_id IS NULL OR manager_id != id);
