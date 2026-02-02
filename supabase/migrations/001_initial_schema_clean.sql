-- Agriplast Database Schema for Supabase
-- Run this in Supabase SQL Editor
-- Note: Supabase automatically handles JWT authentication, no manual configuration needed

-- Drop existing objects if they exist (for clean migration)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS update_quotations_updated_at ON quotations;
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP TABLE IF EXISTS quotations CASCADE;
DROP TABLE IF EXISTS project_snapshots CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;

-- User settings (DSL defaults) - extends auth.users
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  polyhouse_gap REAL DEFAULT 2.0,
  max_side_length REAL DEFAULT 100.0,
  min_side_length REAL DEFAULT 8.0,
  min_corner_distance REAL DEFAULT 4.0,
  gutter_width REAL DEFAULT 2.0,
  block_width REAL DEFAULT 8.0,
  block_height REAL DEFAULT 4.0,
  solar_orientation_enabled BOOLEAN DEFAULT true,
  avoid_water BOOLEAN DEFAULT true,
  consider_slope BOOLEAN DEFAULT false,
  max_slope REAL DEFAULT 15.0,
  company_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects (saved plans)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,

  -- Customer/Client Information
  customer_company_name TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,

  -- Location Information
  location_name TEXT,
  location_address TEXT,

  -- Land and Planning Data
  land_area_sqm REAL NOT NULL,
  land_boundary JSONB NOT NULL,
  polyhouse_count INTEGER NOT NULL,
  total_coverage_sqm REAL NOT NULL,
  utilization_percentage REAL NOT NULL,
  estimated_cost REAL NOT NULL,
  polyhouses JSONB NOT NULL,
  quotation JSONB NOT NULL,
  terrain_analysis JSONB,
  regulatory_compliance JSONB,
  configuration JSONB NOT NULL,

  -- Status and Metadata
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'quoted', 'approved', 'installed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat history for projects
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project snapshots (for undo/redo via chat)
CREATE TABLE project_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_data JSONB NOT NULL,
  created_by_message_id UUID REFERENCES chat_messages(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quotations
CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER DEFAULT 1,
  total_cost REAL NOT NULL,
  items JSONB NOT NULL,
  material_selections JSONB,
  valid_until DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_chat_messages_project_id ON chat_messages(project_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

-- Row Level Security Policies

-- user_settings: Users can only read/write their own settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own settings" ON user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON user_settings FOR UPDATE USING (auth.uid() = user_id);

-- projects: Users can only access their own projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

-- chat_messages: Users can only access messages for their own projects
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own chat messages" ON chat_messages FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM projects WHERE id = project_id));
CREATE POLICY "Users can insert own chat messages" ON chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- project_snapshots: Users can access snapshots for their own projects
ALTER TABLE project_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own snapshots" ON project_snapshots FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM projects WHERE id = project_id));
CREATE POLICY "Users can insert own snapshots" ON project_snapshots FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM projects WHERE id = project_id));

-- quotations: Users can access quotations for their own projects
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own quotations" ON quotations FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM projects WHERE id = project_id));
CREATE POLICY "Users can insert own quotations" ON quotations FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM projects WHERE id = project_id));
CREATE POLICY "Users can update own quotations" ON quotations FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM projects WHERE id = project_id));

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to automatically create user_settings when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_settings (user_id, company_name, phone)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'company_name',
        NEW.raw_user_meta_data->>'phone'
    );
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger to create user_settings automatically on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Triggers for updated_at
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON quotations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
