-- Update user_settings table to ensure all columns exist
-- This is safe to run even if columns already exist (uses IF NOT EXISTS)

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add company_name if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='user_settings' AND column_name='company_name') THEN
    ALTER TABLE public.user_settings ADD COLUMN company_name TEXT;
  END IF;

  -- Add phone if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='user_settings' AND column_name='phone') THEN
    ALTER TABLE public.user_settings ADD COLUMN phone TEXT;
  END IF;

  -- Add safety_buffer if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='user_settings' AND column_name='safety_buffer') THEN
    ALTER TABLE public.user_settings ADD COLUMN safety_buffer REAL DEFAULT 1.0;
  END IF;

  -- Add max_land_area if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='user_settings' AND column_name='max_land_area') THEN
    ALTER TABLE public.user_settings ADD COLUMN max_land_area REAL DEFAULT 10000.0;
  END IF;

  -- Add placement_strategy if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='user_settings' AND column_name='placement_strategy') THEN
    ALTER TABLE public.user_settings ADD COLUMN placement_strategy TEXT DEFAULT 'balanced';
  END IF;

  -- Add land_leveling_override if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='user_settings' AND column_name='land_leveling_override') THEN
    ALTER TABLE public.user_settings ADD COLUMN land_leveling_override BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Update max_side_length default to 120.0 (industry standard)
ALTER TABLE public.user_settings ALTER COLUMN max_side_length SET DEFAULT 120.0;

-- Update any existing rows with old default (100.0) to new default (120.0)
UPDATE public.user_settings SET max_side_length = 120.0 WHERE max_side_length = 100.0;

-- Ensure updated_at trigger exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS set_updated_at ON public.user_settings;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
