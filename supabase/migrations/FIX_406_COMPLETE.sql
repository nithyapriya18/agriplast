-- COMPLETE FIX for 406 error on user_settings
-- This handles all possible causes of the 406 error

-- ============================================
-- STEP 1: Create table if it doesn't exist
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  polyhouse_gap REAL DEFAULT 2.0,
  max_side_length REAL DEFAULT 120.0,
  min_side_length REAL DEFAULT 8.0,
  min_corner_distance REAL DEFAULT 4.0,
  gutter_width REAL DEFAULT 2.0,
  block_width REAL DEFAULT 8.0,
  block_height REAL DEFAULT 4.0,
  safety_buffer REAL DEFAULT 1.0,
  max_land_area REAL DEFAULT 10000.0,
  placement_strategy TEXT DEFAULT 'balanced',
  solar_orientation_enabled BOOLEAN DEFAULT true,
  avoid_water BOOLEAN DEFAULT true,
  consider_slope BOOLEAN DEFAULT false,
  max_slope REAL DEFAULT 15.0,
  land_leveling_override BOOLEAN DEFAULT false,
  company_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 2: Add missing columns to existing table
-- ============================================
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

-- ============================================
-- STEP 3: Enable RLS
-- ============================================
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: Drop and recreate policies
-- ============================================
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.user_settings;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.user_settings;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.user_settings;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.user_settings;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.user_settings;

-- Create simple policies for authenticated users
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

-- ============================================
-- STEP 5: Grant permissions to service_role
-- ============================================
-- This is CRITICAL for backend service to access the table
GRANT ALL ON public.user_settings TO service_role;
GRANT ALL ON public.user_settings TO authenticated;
GRANT SELECT ON public.user_settings TO anon;

-- ============================================
-- STEP 6: Create/update trigger for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.user_settings;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- STEP 7: Update existing data
-- ============================================
-- Update max_side_length to 120m (industry standard)
UPDATE public.user_settings
SET max_side_length = 120.0
WHERE max_side_length = 100.0;

-- ============================================
-- VERIFICATION
-- ============================================
-- Run these to verify the fix worked:
-- SELECT * FROM public.user_settings LIMIT 1;
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'user_settings';
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'user_settings';
