-- Create user_settings table
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

-- Enable Row Level Security
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users can view their own settings
CREATE POLICY "Users can view own settings"
  ON public.user_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own settings
CREATE POLICY "Users can insert own settings"
  ON public.user_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own settings
CREATE POLICY "Users can update own settings"
  ON public.user_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
