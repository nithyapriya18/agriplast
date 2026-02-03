-- Diagnostic queries to troubleshoot the 406 error

-- 1. Check if user_settings table exists
SELECT table_name, table_schema
FROM information_schema.tables
WHERE table_name = 'user_settings';

-- 2. Check all columns in user_settings
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_settings'
ORDER BY ordinal_position;

-- 3. Check RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_settings';

-- 4. Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'user_settings';

-- 5. Verify if anon role has proper access (this is what Supabase client uses)
SELECT has_table_privilege('anon', 'public.user_settings', 'SELECT') as anon_can_select;
SELECT has_table_privilege('authenticated', 'public.user_settings', 'SELECT') as authenticated_can_select;

-- TEMPORARY FIX: If 406 persists, you can temporarily disable RLS for testing
-- WARNING: Only use this for testing, not production!
-- ALTER TABLE public.user_settings DISABLE ROW LEVEL SECURITY;

-- To re-enable RLS after testing:
-- ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- ALTERNATIVE FIX: Make policies more permissive temporarily
-- This allows authenticated users to do everything:
/*
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;

CREATE POLICY "Enable all for authenticated users"
  ON public.user_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
*/
