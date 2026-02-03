-- DROP and RECREATE the user_settings table from scratch
-- This fixes 406 errors caused by corrupt table structure

-- Step 1: Drop existing table completely
DROP TABLE IF EXISTS public.user_settings CASCADE;

-- Step 2: Create table with correct structure
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  polyhouse_gap REAL DEFAULT 2.0,
  max_side_length REAL DEFAULT 120.0,
  min_side_length REAL DEFAULT 8.0,
  min_corner_distance REAL DEFAULT 4.0,
  gutter_width REAL DEFAULT 2.0,
  block_width REAL DEFAULT 8.0,
  block_height REAL DEFAULT 4.0,
  safety_buffer REAL DEFAULT 0.3,
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

-- Step 3: Disable RLS for now (we'll enable it later)
ALTER TABLE public.user_settings DISABLE ROW LEVEL SECURITY;

-- Step 4: Grant all permissions
GRANT ALL ON public.user_settings TO service_role;
GRANT ALL ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO anon;
GRANT ALL ON public.user_settings TO postgres;

-- Step 5: Verify the table was created
SELECT 'Table created successfully!' as status;
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_settings'
ORDER BY ordinal_position;
