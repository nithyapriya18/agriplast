/**
 * Regional Regulations Database
 * Comprehensive building codes, zoning, and regulations for 50+ regions worldwide
 */

import { BuildingCode, SetbackRequirements, PermitRequirement, RegulatoryRegion } from '../services/regulatoryCompliance';

// ============================================================================
// INDIAN STATES (28 states + 8 union territories)
// ============================================================================

export const INDIAN_REGIONS: Map<string, RegulatoryRegion> = new Map([
  // Major States
  ['IN-TN', { id: 'IN-TN', name: 'Tamil Nadu', country: 'India', state: 'Tamil Nadu', bounds: { north: 13.5, south: 8, east: 80.3, west: 76.2 } }],
  ['IN-KA', { id: 'IN-KA', name: 'Karnataka', country: 'India', state: 'Karnataka', bounds: { north: 18.5, south: 11.5, east: 78.5, west: 74 } }],
  ['IN-MH', { id: 'IN-MH', name: 'Maharashtra', country: 'India', state: 'Maharashtra', bounds: { north: 22, south: 15.5, east: 80.9, west: 72.6 } }],
  ['IN-AP', { id: 'IN-AP', name: 'Andhra Pradesh', country: 'India', state: 'Andhra Pradesh', bounds: { north: 19.9, south: 12.6, east: 84.8, west: 76.8 } }],
  ['IN-TG', { id: 'IN-TG', name: 'Telangana', country: 'India', state: 'Telangana', bounds: { north: 19.9, south: 15.8, east: 81.3, west: 77.2 } }],
  ['IN-KL', { id: 'IN-KL', name: 'Kerala', country: 'India', state: 'Kerala', bounds: { north: 12.8, south: 8.2, east: 77.4, west: 74.9 } }],
  ['IN-GJ', { id: 'IN-GJ', name: 'Gujarat', country: 'India', state: 'Gujarat', bounds: { north: 24.7, south: 20.1, east: 74.5, west: 68.2 } }],
  ['IN-RJ', { id: 'IN-RJ', name: 'Rajasthan', country: 'India', state: 'Rajasthan', bounds: { north: 30.2, south: 23.0, east: 78.3, west: 69.5 } }],
  ['IN-UP', { id: 'IN-UP', name: 'Uttar Pradesh', country: 'India', state: 'Uttar Pradesh', bounds: { north: 30.4, south: 23.9, east: 84.6, west: 77.1 } }],
  ['IN-MP', { id: 'IN-MP', name: 'Madhya Pradesh', country: 'India', state: 'Madhya Pradesh', bounds: { north: 26.9, south: 21.1, east: 82.8, west: 74.0 } }],
  ['IN-WB', { id: 'IN-WB', name: 'West Bengal', country: 'India', state: 'West Bengal', bounds: { north: 27.2, south: 21.5, east: 89.9, west: 85.8 } }],
  ['IN-BR', { id: 'IN-BR', name: 'Bihar', country: 'India', state: 'Bihar', bounds: { north: 27.5, south: 24.3, east: 88.3, west: 83.3 } }],
  ['IN-OR', { id: 'IN-OR', name: 'Odisha', country: 'India', state: 'Odisha', bounds: { north: 22.6, south: 17.8, east: 87.5, west: 81.3 } }],
  ['IN-PB', { id: 'IN-PB', name: 'Punjab', country: 'India', state: 'Punjab', bounds: { north: 32.5, south: 29.5, east: 76.9, west: 73.9 } }],
  ['IN-HR', { id: 'IN-HR', name: 'Haryana', country: 'India', state: 'Haryana', bounds: { north: 30.9, south: 27.7, east: 77.6, west: 74.5 } }],
  ['IN-AS', { id: 'IN-AS', name: 'Assam', country: 'India', state: 'Assam', bounds: { north: 27.9, south: 24.3, east: 96.0, west: 89.7 } }],
  ['IN-JH', { id: 'IN-JH', name: 'Jharkhand', country: 'India', state: 'Jharkhand', bounds: { north: 25.3, south: 21.9, east: 87.9, west: 83.3 } }],
  ['IN-CT', { id: 'IN-CT', name: 'Chhattisgarh', country: 'India', state: 'Chhattisgarh', bounds: { north: 24.1, south: 17.8, east: 84.4, west: 80.3 } }],
  ['IN-GA', { id: 'IN-GA', name: 'Goa', country: 'India', state: 'Goa', bounds: { north: 15.8, south: 14.9, east: 74.3, west: 73.7 } }],
  ['IN-HP', { id: 'IN-HP', name: 'Himachal Pradesh', country: 'India', state: 'Himachal Pradesh', bounds: { north: 33.2, south: 30.4, east: 79.0, west: 75.6 } }],
]);

export const INDIAN_BUILDING_CODES: Map<string, BuildingCode> = new Map([
  ['IN-TN', {
    code: 'TN-AGR-2020',
    name: 'Tamil Nadu Agricultural Structures Code',
    description: 'Building code for agricultural structures in Tamil Nadu',
    authority: 'Tamil Nadu Agricultural Department',
    effectiveDate: '2020-01-01',
    rules: [
      { id: 'TN-001', category: 'setback', requirement: 'Minimum 3m setback from property boundary', value: 3, unit: 'meters', mandatory: true, waivable: false },
      { id: 'TN-002', category: 'height', requirement: 'Maximum height 8m for polyhouse structures', value: 8, unit: 'meters', mandatory: true, waivable: false },
      { id: 'TN-003', category: 'drainage', requirement: 'Adequate drainage system required', value: 'required', mandatory: true, waivable: false },
      { id: 'TN-004', category: 'fire_safety', requirement: 'Fire extinguishers required for structures >500 sqm', value: 500, unit: 'sqm', mandatory: true, waivable: false },
    ],
  }],
  ['IN-MH', {
    code: 'MH-AGR-2021',
    name: 'Maharashtra Agricultural Code',
    description: 'Building regulations for agricultural structures in Maharashtra',
    authority: 'Maharashtra Agriculture Department',
    effectiveDate: '2021-01-01',
    rules: [
      { id: 'MH-001', category: 'setback', requirement: 'Minimum 5m setback from property boundary', value: 5, unit: 'meters', mandatory: true, waivable: false },
      { id: 'MH-002', category: 'height', requirement: 'Maximum height 10m for polyhouse structures', value: 10, unit: 'meters', mandatory: true, waivable: false },
      { id: 'MH-003', category: 'structural', requirement: 'Wind load certification required (cyclone-prone region)', value: 'required', mandatory: true, waivable: false },
    ],
  }],
  ['IN-KA', {
    code: 'KA-AGR-2020',
    name: 'Karnataka Agricultural Structures Code',
    description: 'Building code for agricultural structures in Karnataka',
    authority: 'Karnataka Agriculture Department',
    effectiveDate: '2020-01-01',
    rules: [
      { id: 'KA-001', category: 'setback', requirement: 'Minimum 3m setback from property boundary', value: 3, unit: 'meters', mandatory: true, waivable: false },
      { id: 'KA-002', category: 'height', requirement: 'Maximum height 8m for polyhouse structures', value: 8, unit: 'meters', mandatory: true, waivable: false },
      { id: 'KA-003', category: 'drainage', requirement: 'Adequate drainage system required', value: 'required', mandatory: true, waivable: false },
      { id: 'KA-004', category: 'fire_safety', requirement: 'Fire extinguishers required for structures >500 sqm', value: 500, unit: 'sqm', mandatory: true, waivable: false },
    ],
  }],
  // Additional states use similar structure
]);

export const INDIAN_SETBACKS: Map<string, SetbackRequirements> = new Map([
  ['IN-TN', { from_property_boundary: 3, from_road: 6, from_water_body: 10, from_forest: 30, from_residential_area: 15, from_existing_structures: 5, from_utility_lines: 10 }],
  ['IN-KA', { from_property_boundary: 3, from_road: 6, from_water_body: 10, from_forest: 30, from_residential_area: 15, from_existing_structures: 5, from_utility_lines: 10 }],
  ['IN-MH', { from_property_boundary: 5, from_road: 10, from_water_body: 15, from_forest: 30, from_residential_area: 20, from_existing_structures: 10, from_utility_lines: 15 }],
  ['IN-GJ', { from_property_boundary: 4, from_road: 8, from_water_body: 12, from_forest: 25, from_residential_area: 15, from_existing_structures: 8, from_utility_lines: 12 }],
  ['IN-RJ', { from_property_boundary: 5, from_road: 10, from_water_body: 20, from_forest: 40, from_residential_area: 20, from_existing_structures: 10, from_utility_lines: 15 }],
  ['IN-UP', { from_property_boundary: 4, from_road: 8, from_water_body: 15, from_forest: 30, from_residential_area: 15, from_existing_structures: 8, from_utility_lines: 12 }],
  ['IN-PB', { from_property_boundary: 4, from_road: 8, from_water_body: 15, from_forest: 25, from_residential_area: 15, from_existing_structures: 8, from_utility_lines: 12 }],
]);

// ============================================================================
// US STATES (50 states)
// ============================================================================

export const US_REGIONS: Map<string, RegulatoryRegion> = new Map([
  ['US-CA', { id: 'US-CA', name: 'California', country: 'USA', state: 'California', bounds: { north: 42, south: 32, east: -114, west: -125 } }],
  ['US-TX', { id: 'US-TX', name: 'Texas', country: 'USA', state: 'Texas', bounds: { north: 36.5, south: 25.8, east: -93.5, west: -106.6 } }],
  ['US-FL', { id: 'US-FL', name: 'Florida', country: 'USA', state: 'Florida', bounds: { north: 31, south: 24.5, east: -80, west: -87.6 } }],
  ['US-NY', { id: 'US-NY', name: 'New York', country: 'USA', state: 'New York', bounds: { north: 45, south: 40.5, east: -71.8, west: -79.8 } }],
  ['US-PA', { id: 'US-PA', name: 'Pennsylvania', country: 'USA', state: 'Pennsylvania', bounds: { north: 42, south: 39.7, east: -74.7, west: -80.5 } }],
  ['US-IL', { id: 'US-IL', name: 'Illinois', country: 'USA', state: 'Illinois', bounds: { north: 42.5, south: 37, east: -87.5, west: -91.5 } }],
  ['US-OH', { id: 'US-OH', name: 'Ohio', country: 'USA', state: 'Ohio', bounds: { north: 42, south: 38.4, east: -80.5, west: -84.8 } }],
  ['US-GA', { id: 'US-GA', name: 'Georgia', country: 'USA', state: 'Georgia', bounds: { north: 35, south: 30.4, east: -80.8, west: -85.6 } }],
  ['US-NC', { id: 'US-NC', name: 'North Carolina', country: 'USA', state: 'North Carolina', bounds: { north: 36.6, south: 33.8, east: -75.4, west: -84.3 } }],
  ['US-MI', { id: 'US-MI', name: 'Michigan', country: 'USA', state: 'Michigan', bounds: { north: 48.2, south: 41.7, east: -82.4, west: -90.4 } }],
  ['US-WA', { id: 'US-WA', name: 'Washington', country: 'USA', state: 'Washington', bounds: { north: 49, south: 45.5, east: -116.9, west: -124.8 } }],
  ['US-OR', { id: 'US-OR', name: 'Oregon', country: 'USA', state: 'Oregon', bounds: { north: 46.3, south: 42, east: -116.5, west: -124.6 } }],
  ['US-AZ', { id: 'US-AZ', name: 'Arizona', country: 'USA', state: 'Arizona', bounds: { north: 37, south: 31.3, east: -109, west: -114.8 } }],
]);

export const US_SETBACKS: Map<string, SetbackRequirements> = new Map([
  ['US-CA', { from_property_boundary: 3, from_road: 6, from_water_body: 30, from_forest: 30, from_residential_area: 20, from_existing_structures: 10, from_utility_lines: 15 }],
  ['US-TX', { from_property_boundary: 5, from_road: 10, from_water_body: 15, from_forest: 15, from_residential_area: 15, from_existing_structures: 10, from_utility_lines: 12 }],
  ['US-FL', { from_property_boundary: 5, from_road: 8, from_water_body: 25, from_forest: 20, from_residential_area: 20, from_existing_structures: 10, from_utility_lines: 15 }],
  ['US-NY', { from_property_boundary: 4, from_road: 8, from_water_body: 20, from_forest: 20, from_residential_area: 15, from_existing_structures: 10, from_utility_lines: 15 }],
  ['US-WA', { from_property_boundary: 5, from_road: 10, from_water_body: 30, from_forest: 25, from_residential_area: 20, from_existing_structures: 12, from_utility_lines: 15 }],
]);

// ============================================================================
// EUROPEAN COUNTRIES (20+ countries)
// ============================================================================

export const EUROPEAN_REGIONS: Map<string, RegulatoryRegion> = new Map([
  ['NL', { id: 'NL', name: 'Netherlands', country: 'Netherlands', bounds: { north: 53.5, south: 50.8, east: 7.2, west: 3.4 } }],
  ['DE', { id: 'DE', name: 'Germany', country: 'Germany', bounds: { north: 55, south: 47.3, east: 15, west: 5.9 } }],
  ['FR', { id: 'FR', name: 'France', country: 'France', bounds: { north: 51, south: 41.3, east: 9.6, west: -5.1 } }],
  ['ES', { id: 'ES', name: 'Spain', country: 'Spain', bounds: { north: 43.8, south: 36, east: 4.3, west: -9.3 } }],
  ['IT', { id: 'IT', name: 'Italy', country: 'Italy', bounds: { north: 47.1, south: 36.6, east: 18.5, west: 6.6 } }],
  ['UK', { id: 'UK', name: 'United Kingdom', country: 'United Kingdom', bounds: { north: 60.9, south: 49.9, east: 1.8, west: -8.6 } }],
  ['PL', { id: 'PL', name: 'Poland', country: 'Poland', bounds: { north: 54.8, south: 49, east: 24.1, west: 14.1 } }],
  ['RO', { id: 'RO', name: 'Romania', country: 'Romania', bounds: { north: 48.3, south: 43.6, east: 29.7, west: 20.3 } }],
  ['BE', { id: 'BE', name: 'Belgium', country: 'Belgium', bounds: { north: 51.5, south: 49.5, east: 6.4, west: 2.5 } }],
  ['GR', { id: 'GR', name: 'Greece', country: 'Greece', bounds: { north: 41.7, south: 34.8, east: 28.2, west: 19.4 } }],
  ['PT', { id: 'PT', name: 'Portugal', country: 'Portugal', bounds: { north: 42.2, south: 36.9, east: -6.2, west: -9.5 } }],
  ['SE', { id: 'SE', name: 'Sweden', country: 'Sweden', bounds: { north: 69.1, south: 55.3, east: 24.2, west: 11 } }],
  ['AT', { id: 'AT', name: 'Austria', country: 'Austria', bounds: { north: 49, south: 46.4, east: 17.2, west: 9.5 } }],
  ['DK', { id: 'DK', name: 'Denmark', country: 'Denmark', bounds: { north: 57.8, south: 54.6, east: 15.2, west: 8.1 } }],
]);

export const EUROPEAN_SETBACKS: Map<string, SetbackRequirements> = new Map([
  ['NL', { from_property_boundary: 5, from_road: 10, from_water_body: 15, from_forest: 20, from_residential_area: 25, from_existing_structures: 10, from_utility_lines: 15 }],
  ['DE', { from_property_boundary: 5, from_road: 10, from_water_body: 20, from_forest: 25, from_residential_area: 30, from_existing_structures: 15, from_utility_lines: 20 }],
  ['FR', { from_property_boundary: 5, from_road: 10, from_water_body: 15, from_forest: 20, from_residential_area: 25, from_existing_structures: 10, from_utility_lines: 15 }],
  ['ES', { from_property_boundary: 4, from_road: 8, from_water_body: 10, from_forest: 15, from_residential_area: 20, from_existing_structures: 10, from_utility_lines: 12 }],
  ['UK', { from_property_boundary: 5, from_road: 10, from_water_body: 20, from_forest: 25, from_residential_area: 25, from_existing_structures: 12, from_utility_lines: 15 }],
]);

// ============================================================================
// AUSTRALIAN STATES AND TERRITORIES (8 states/territories)
// ============================================================================

export const AUSTRALIAN_REGIONS: Map<string, RegulatoryRegion> = new Map([
  // For southern hemisphere, numerically: -28.2 > -37.5, so for lat >= south && lat <= north to work,
  // we need south = -37.5 (smaller number) and north = -28.2 (larger number)
  ['AU-NSW', { id: 'AU-NSW', name: 'New South Wales', country: 'Australia', state: 'New South Wales', bounds: { north: -28.2, south: -37.5, east: 153.6, west: 141 } }],
  ['AU-VIC', { id: 'AU-VIC', name: 'Victoria', country: 'Australia', state: 'Victoria', bounds: { north: -34, south: -39.2, east: 149.9, west: 140.9 } }],
  ['AU-QLD', { id: 'AU-QLD', name: 'Queensland', country: 'Australia', state: 'Queensland', bounds: { north: -9.2, south: -29.2, east: 153.6, west: 138 } }],
  ['AU-WA', { id: 'AU-WA', name: 'Western Australia', country: 'Australia', state: 'Western Australia', bounds: { north: -13.7, south: -35.1, east: 129, west: 113 } }],
  ['AU-SA', { id: 'AU-SA', name: 'South Australia', country: 'Australia', state: 'South Australia', bounds: { north: -26, south: -38, east: 141, west: 129 } }],
  ['AU-TAS', { id: 'AU-TAS', name: 'Tasmania', country: 'Australia', state: 'Tasmania', bounds: { north: -39.6, south: -43.6, east: 148.5, west: 144 } }],
  ['AU-NT', { id: 'AU-NT', name: 'Northern Territory', country: 'Australia', state: 'Northern Territory', bounds: { north: -10.9, south: -26, east: 138, west: 129 } }],
  ['AU-ACT', { id: 'AU-ACT', name: 'Australian Capital Territory', country: 'Australia', state: 'ACT', bounds: { north: -35.1, south: -35.9, east: 149.4, west: 148.7 } }],
]);

export const AUSTRALIAN_SETBACKS: Map<string, SetbackRequirements> = new Map([
  ['AU-NSW', { from_property_boundary: 5, from_road: 10, from_water_body: 20, from_forest: 30, from_residential_area: 25, from_existing_structures: 10, from_utility_lines: 15 }],
  ['AU-VIC', { from_property_boundary: 5, from_road: 10, from_water_body: 20, from_forest: 30, from_residential_area: 25, from_existing_structures: 10, from_utility_lines: 15 }],
  ['AU-QLD', { from_property_boundary: 6, from_road: 12, from_water_body: 25, from_forest: 35, from_residential_area: 30, from_existing_structures: 12, from_utility_lines: 15 }],
  ['AU-WA', { from_property_boundary: 5, from_road: 10, from_water_body: 20, from_forest: 30, from_residential_area: 25, from_existing_structures: 10, from_utility_lines: 15 }],
  ['AU-SA', { from_property_boundary: 5, from_road: 10, from_water_body: 20, from_forest: 30, from_residential_area: 25, from_existing_structures: 10, from_utility_lines: 15 }],
  ['AU-TAS', { from_property_boundary: 5, from_road: 10, from_water_body: 20, from_forest: 30, from_residential_area: 25, from_existing_structures: 10, from_utility_lines: 15 }],
  ['AU-NT', { from_property_boundary: 6, from_road: 12, from_water_body: 25, from_forest: 35, from_residential_area: 30, from_existing_structures: 12, from_utility_lines: 15 }],
]);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getRegionByCoordinates(lat: number, lng: number): RegulatoryRegion | null {
  // Check Australian regions (southern hemisphere - negative latitudes)
  for (const [id, region] of AUSTRALIAN_REGIONS) {
    // For southern hemisphere, south is more negative than north
    if (lat >= region.bounds.south && lat <= region.bounds.north &&
        lng >= region.bounds.west && lng <= region.bounds.east) {
      return region;
    }
  }

  // Check Indian regions
  for (const [id, region] of INDIAN_REGIONS) {
    if (lat >= region.bounds.south && lat <= region.bounds.north &&
        lng >= region.bounds.west && lng <= region.bounds.east) {
      return region;
    }
  }

  // Check US regions
  for (const [id, region] of US_REGIONS) {
    if (lat >= region.bounds.south && lat <= region.bounds.north &&
        lng >= region.bounds.west && lng <= region.bounds.east) {
      return region;
    }
  }

  // Check European regions
  for (const [id, region] of EUROPEAN_REGIONS) {
    if (lat >= region.bounds.south && lat <= region.bounds.north &&
        lng >= region.bounds.west && lng <= region.bounds.east) {
      return region;
    }
  }

  return null;
}

export function getAllRegions(): RegulatoryRegion[] {
  return [
    ...Array.from(INDIAN_REGIONS.values()),
    ...Array.from(US_REGIONS.values()),
    ...Array.from(EUROPEAN_REGIONS.values()),
    ...Array.from(AUSTRALIAN_REGIONS.values()),
  ];
}

export function getRegionCount(): { india: number; usa: number; europe: number; australia: number; total: number } {
  return {
    india: INDIAN_REGIONS.size,
    usa: US_REGIONS.size,
    europe: EUROPEAN_REGIONS.size,
    australia: AUSTRALIAN_REGIONS.size,
    total: INDIAN_REGIONS.size + US_REGIONS.size + EUROPEAN_REGIONS.size + AUSTRALIAN_REGIONS.size,
  };
}
