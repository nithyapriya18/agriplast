-- QUICK FIX for 406 error on user_settings
-- This replaces restrictive policies with simpler ones

-- 1. Drop all existing policies
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.user_settings;

-- 2. Create simple, permissive policies for authenticated users
CREATE POLICY "Enable read for authenticated users"
  ON public.user_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Enable insert for authenticated users"
  ON public.user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for authenticated users"
  ON public.user_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable delete for authenticated users"
  ON public.user_settings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Ensure table has all required columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='user_settings' AND column_name='company_name') THEN
    ALTER TABLE public.user_settings ADD COLUMN company_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='user_settings' AND column_name='phone') THEN
    ALTER TABLE public.user_settings ADD COLUMN phone TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='user_settings' AND column_name='safety_buffer') THEN
    ALTER TABLE public.user_settings ADD COLUMN safety_buffer REAL DEFAULT 1.0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='user_settings' AND column_name='max_land_area') THEN
    ALTER TABLE public.user_settings ADD COLUMN max_land_area REAL DEFAULT 10000.0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='user_settings' AND column_name='placement_strategy') THEN
    ALTER TABLE public.user_settings ADD COLUMN placement_strategy TEXT DEFAULT 'balanced';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='user_settings' AND column_name='land_leveling_override') THEN
    ALTER TABLE public.user_settings ADD COLUMN land_leveling_override BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 4. Update max_side_length to 120m
UPDATE public.user_settings SET max_side_length = 120.0 WHERE max_side_length = 100.0;
