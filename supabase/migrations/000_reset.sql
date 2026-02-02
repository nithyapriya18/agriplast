-- Reset script - Run this first if you need to clean up existing schema
-- WARNING: This will delete all data!

-- Drop triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS update_quotations_updated_at ON quotations;

-- Drop functions
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables (CASCADE will drop dependent objects like policies)
DROP TABLE IF EXISTS quotations CASCADE;
DROP TABLE IF EXISTS project_snapshots CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
