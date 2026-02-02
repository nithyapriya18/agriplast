-- Add missing user settings columns for full configurability
-- Run this migration in Supabase SQL Editor after running 001_initial_schema.sql

-- Add max_land_area setting (configurable limit for single polyhouse size)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS max_land_area REAL DEFAULT 10000.0;

-- Add land_leveling_override setting (user can override to allow building on slopes)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS land_leveling_override BOOLEAN DEFAULT false;

-- Add safety_buffer setting (distance from land boundary)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS safety_buffer REAL DEFAULT 1.0;

-- Add placement_strategy setting (optimization goal)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS placement_strategy TEXT DEFAULT 'balanced'
  CHECK (placement_strategy IN ('maximize_blocks', 'maximize_coverage', 'balanced', 'equal_area'));

-- Add additional project tracking columns
ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_company_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS location_address TEXT;

-- Add comments for documentation
COMMENT ON COLUMN user_settings.max_land_area IS 'Maximum land area (sqm) for a single polyhouse - default 10000 sqm';
COMMENT ON COLUMN user_settings.land_leveling_override IS 'User undertakes to level the land - allows building on slopes';
COMMENT ON COLUMN user_settings.safety_buffer IS 'Safety buffer distance from land boundary (meters) - default 1m';
COMMENT ON COLUMN user_settings.placement_strategy IS 'Optimization strategy: maximize_blocks, maximize_coverage, balanced, or equal_area';
COMMENT ON COLUMN projects.customer_company_name IS 'Customer company name for quotation';
COMMENT ON COLUMN projects.contact_name IS 'Primary contact person name';
COMMENT ON COLUMN projects.contact_email IS 'Primary contact email';
COMMENT ON COLUMN projects.contact_phone IS 'Primary contact phone number';
COMMENT ON COLUMN projects.location_address IS 'Full address of the project location';
