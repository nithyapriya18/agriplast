-- Add pricing configuration to user settings
-- Allows users to customize all material costs, labor rates, and service charges

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS pricing_tier TEXT DEFAULT 'standard' CHECK (pricing_tier IN ('economy', 'standard', 'premium'));

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS custom_pricing JSONB DEFAULT NULL;

-- Add comment explaining the custom_pricing structure
COMMENT ON COLUMN user_settings.custom_pricing IS 'Custom pricing configuration overriding defaults. Follows PricingConfiguration structure from pricingConfig.ts';

COMMENT ON COLUMN user_settings.pricing_tier IS 'Default pricing tier: economy, standard, or premium. Used when custom_pricing is null';

-- Add service and business configuration fields
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS service_charge_percentage REAL DEFAULT 12.0;

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS profit_margin_percentage REAL DEFAULT 22.0;

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS gst_percentage REAL DEFAULT 18.0;

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS transportation_cost_per_km REAL DEFAULT 18.0;

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS installation_labor_rate REAL DEFAULT 75.0;

-- Add comments
COMMENT ON COLUMN user_settings.service_charge_percentage IS 'Service fee percentage on material cost (default: 12%)';
COMMENT ON COLUMN user_settings.profit_margin_percentage IS 'Profit margin percentage on subtotal (default: 22%)';
COMMENT ON COLUMN user_settings.gst_percentage IS 'GST percentage (default: 18%)';
COMMENT ON COLUMN user_settings.transportation_cost_per_km IS 'Transportation cost per km per ton in INR (default: 18)';
COMMENT ON COLUMN user_settings.installation_labor_rate IS 'Installation labor rate per sqm in INR (default: 75)';
