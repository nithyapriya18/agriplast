'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface UserSettings {
  polyhouse_gap: number;
  max_side_length: number;
  min_side_length: number;
  min_corner_distance: number;
  gutter_width: number;
  block_width: number;
  block_height: number;
  safety_buffer: number;
  max_land_area: number;
  placement_strategy: 'maximize_blocks' | 'maximize_coverage' | 'balanced' | 'equal_area';
  solar_orientation_enabled: boolean;
  avoid_water: boolean;
  consider_slope: boolean;
  max_slope: number;
  land_leveling_override: boolean;
  company_name: string;
  phone: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings>({
    polyhouse_gap: 2.0,
    max_side_length: 100.0,
    min_side_length: 8.0,
    min_corner_distance: 4.0,
    gutter_width: 2.0,
    block_width: 8.0,
    block_height: 4.0,
    safety_buffer: 1.0,
    max_land_area: 10000.0,
    placement_strategy: 'balanced',
    solar_orientation_enabled: true,
    avoid_water: true,
    consider_slope: false,
    max_slope: 15.0,
    land_leveling_override: false,
    company_name: '',
    phone: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      setUser(user);

      // Load user settings
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = not found, which is okay for new users
        throw error;
      }

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            ...settings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (error) throw error;

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof UserSettings, value: any) => {
    setSettings({ ...settings, [field]: value });
  };

  const handleReset = () => {
    if (!confirm('Reset all settings to defaults?')) return;

    setSettings({
      polyhouse_gap: 2.0,
      max_side_length: 100.0,
      min_side_length: 8.0,
      min_corner_distance: 4.0,
      gutter_width: 2.0,
      block_width: 8.0,
      block_height: 4.0,
      safety_buffer: 1.0,
      max_land_area: 10000.0,
      placement_strategy: 'balanced',
      solar_orientation_enabled: true,
      avoid_water: true,
      consider_slope: false,
      max_slope: 15.0,
      land_leveling_override: false,
      company_name: settings.company_name,
      phone: settings.phone,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Settings</h1>
              <p className="text-sm text-gray-500">Configure default DSL parameters</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Company Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={settings.company_name}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={settings.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Polyhouse Dimensions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Polyhouse Dimensions</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Block Width (meters)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.block_width}
                  onChange={(e) => handleChange('block_width', parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Standard: 8m</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Block Height (meters)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.block_height}
                  onChange={(e) => handleChange('block_height', parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Standard: 4m</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gutter Width (meters)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.gutter_width}
                  onChange={(e) => handleChange('gutter_width', parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Drainage gutter on east-west sides</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Polyhouse Gap (meters)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="2"
                  value={settings.polyhouse_gap}
                  onChange={(e) => handleChange('polyhouse_gap', parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum: 2m, affects access and density</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Safety Buffer (meters)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={settings.safety_buffer}
                  onChange={(e) => handleChange('safety_buffer', parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Distance from land boundary (0-5m)</p>
              </div>
            </div>
          </div>

          {/* Size Constraints */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Size Constraints</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Side Length (meters)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.min_side_length}
                  onChange={(e) => handleChange('min_side_length', parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum polyhouse dimension</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Side Length (meters)
                </label>
                <input
                  type="number"
                  step="1"
                  value={settings.max_side_length}
                  onChange={(e) => handleChange('max_side_length', parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum structural limit</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Corner Distance (meters)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.min_corner_distance}
                  onChange={(e) => handleChange('min_corner_distance', parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Controls L-shapes complexity</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Land Area per Polyhouse (sqm)
                </label>
                <input
                  type="number"
                  step="100"
                  value={settings.max_land_area}
                  onChange={(e) => handleChange('max_land_area', parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum size for a single polyhouse</p>
              </div>
            </div>
          </div>

          {/* Placement Strategy */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Placement Strategy</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Optimization Goal
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleChange('placement_strategy', 'balanced')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    settings.placement_strategy === 'balanced'
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">Balanced (Recommended)</div>
                  <div className="text-xs text-gray-500 mt-1">Mix of coverage and efficiency</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleChange('placement_strategy', 'maximize_coverage')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    settings.placement_strategy === 'maximize_coverage'
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">Maximize Coverage</div>
                  <div className="text-xs text-gray-500 mt-1">Fill as much land as possible</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleChange('placement_strategy', 'maximize_blocks')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    settings.placement_strategy === 'maximize_blocks'
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">Maximize Blocks</div>
                  <div className="text-xs text-gray-500 mt-1">Place as many blocks as possible</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleChange('placement_strategy', 'equal_area')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    settings.placement_strategy === 'equal_area'
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">Equal Area</div>
                  <div className="text-xs text-gray-500 mt-1">Make polyhouses similar size</div>
                </button>
              </div>
            </div>
          </div>

          {/* Terrain Constraints */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Terrain Constraints</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Solar Orientation</label>
                  <p className="text-xs text-gray-500">Mandatory for plant growth (gutters need sunlight)</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.solar_orientation_enabled}
                  onChange={(e) => handleChange('solar_orientation_enabled', e.target.checked)}
                  className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Avoid Water Bodies</label>
                  <p className="text-xs text-gray-500">Detect and avoid building on water (Copernicus types 80, 200, 210)</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.avoid_water}
                  onChange={(e) => handleChange('avoid_water', e.target.checked)}
                  className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Consider Slope</label>
                  <p className="text-xs text-gray-500">Avoid steep slopes (configurable threshold below)</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.consider_slope}
                  onChange={(e) => handleChange('consider_slope', e.target.checked)}
                  className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
              </div>

              {settings.consider_slope && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Slope (degrees)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={settings.max_slope}
                    onChange={(e) => handleChange('max_slope', parseFloat(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Slopes steeper than this will be avoided</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Land Leveling Override</label>
                  <p className="text-xs text-gray-500">User undertakes to level the land - allows building on slopes</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.land_leveling_override}
                  onChange={(e) => handleChange('land_leveling_override', e.target.checked)}
                  className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Reset to Defaults
            </button>

            <div className="flex gap-3">
              <Link
                href="/dashboard"
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
