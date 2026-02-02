/**
 * Solar orientation calculations based on latitude
 * Determines optimal polyhouse orientation for maximum sun exposure
 */

export interface SolarOrientation {
  baseOrientation: number; // degrees from north (0-360)
  allowedDeviation: number; // degrees of acceptable deviation
}

/**
 * Calculate solar orientation based on latitude
 *
 * Rules:
 * - At equator (0°): Any orientation is fine
 * - Between equator and tropics (0-23.44°): Allow up to 23.44° deviation
 * - At tropics (23.44°N/S): Strictly north-south with ±23.44° deviation
 * - Between tropics and polar circles (23.44-66.5°): North-south with latitude-based deviation
 * - Beyond polar circles (>66.5°): Strictly north-south
 */
export function calculateSolarOrientation(latitudeDegrees: number): SolarOrientation {
  const absLat = Math.abs(latitudeDegrees);

  // Constants
  const TROPIC = 23.44; // Tropic of Cancer/Capricorn
  const ARCTIC_CIRCLE = 66.5;

  // Base orientation is always north-south (0° or 180°)
  const baseOrientation = 0; // 0° = North-South

  let allowedDeviation: number;

  if (absLat === 0) {
    // At equator: orientation doesn't matter
    allowedDeviation = 180; // Any orientation
  } else if (absLat < TROPIC) {
    // Between equator and tropic: allow deviation proportional to distance from tropic
    // At equator: 180° deviation, at tropic: 23.44° deviation
    allowedDeviation = TROPIC + (180 - TROPIC) * (1 - absLat / TROPIC);
  } else if (absLat <= ARCTIC_CIRCLE) {
    // Between tropic and arctic circle: use arcsin formula
    // This allows for sun's declination angle throughout the year
    const deviationFactor = Math.asin(Math.tan(TROPIC * Math.PI / 180) / Math.tan(absLat * Math.PI / 180));
    allowedDeviation = Math.abs(deviationFactor * 180 / Math.PI);
  } else {
    // Beyond arctic circle: strictly north-south
    allowedDeviation = 0;
  }

  return {
    baseOrientation,
    allowedDeviation: Math.min(allowedDeviation, 180), // Cap at 180°
  };
}

/**
 * Check if a given orientation is valid for the latitude
 */
export function isOrientationValid(
  orientation: number,
  latitudeDegrees: number
): boolean {
  const { baseOrientation, allowedDeviation } = calculateSolarOrientation(latitudeDegrees);

  // Normalize orientation to 0-360
  const normalizedOrientation = ((orientation % 360) + 360) % 360;

  // Calculate angular difference
  let diff = Math.abs(normalizedOrientation - baseOrientation);
  if (diff > 180) {
    diff = 360 - diff;
  }

  return diff <= allowedDeviation;
}

/**
 * Get suggested orientations for a given latitude
 */
export function getSuggestedOrientations(latitudeDegrees: number): number[] {
  const { baseOrientation, allowedDeviation } = calculateSolarOrientation(latitudeDegrees);

  if (allowedDeviation >= 180) {
    // Any orientation is fine
    return [0, 45, 90, 135];
  }

  if (allowedDeviation === 0) {
    // Only north-south
    return [0];
  }

  // Return base orientation and deviations
  const orientations = [baseOrientation];

  if (allowedDeviation > 10) {
    orientations.push((baseOrientation + allowedDeviation / 2) % 360);
    orientations.push((baseOrientation - allowedDeviation / 2 + 360) % 360);
  }

  if (allowedDeviation > 20) {
    orientations.push((baseOrientation + allowedDeviation) % 360);
    orientations.push((baseOrientation - allowedDeviation + 360) % 360);
  }

  return orientations;
}
