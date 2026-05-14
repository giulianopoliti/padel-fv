-- ================================================================
-- ADMIN USER BOOTSTRAP
-- ================================================================
-- Production-safe note:
-- Do not create auth users with hardcoded passwords in migrations.
-- Create the admin user from Supabase Auth Dashboard, then promote it
-- with a one-off SQL statement after migrations are applied.
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE 'Skipping automatic ADMIN user creation. Create the admin in Supabase Auth and promote it manually.';
END $$;
