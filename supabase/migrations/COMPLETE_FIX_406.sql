-- COMPLETE FIX for 406 error
-- Run this entire script in Supabase SQL Editor

-- Step 1: Drop ALL existing policies (clean slate)
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.user_settings;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.user_settings;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.user_settings;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.user_settings;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.user_settings;

-- Step 2: Create SIMPLE policies that definitely work
CREATE POLICY "allow_authenticated_select"
  ON public.user_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "allow_authenticated_insert"
  ON public.user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "allow_authenticated_update"
  ON public.user_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Step 3: Grant permissions
GRANT ALL ON public.user_settings TO service_role;
GRANT ALL ON public.user_settings TO authenticated;
GRANT SELECT ON public.user_settings TO anon;

-- Step 4: Verify the table exists and has correct columns
-- If this fails, the table doesn't exist or is missing columns
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'user_settings'
ORDER BY ordinal_position;
