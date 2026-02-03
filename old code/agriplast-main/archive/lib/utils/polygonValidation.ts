/**
 * Polygon validation utilities for client-side use
 * Returns validation results with errors and area
 */

import type { ValidationError } from '@/lib/api/types';

/**
 * Calculate polygon area in square meters
 */
function calculatePolygonArea(coordinates: Array<{ lat: number; lng: number }>): number {
  if (coordinates.length < 3) return 0;

  // Use spherical excess formula for accurate area calculation
  let area = 0;
  const R = 6371000; // Earth radius in meters

  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length;
    const lat1 = coordinates[i].lat * Math.PI / 180;
    const lat2 = coordinates[j].lat * Math.PI / 180;
    const dLng = (coordinates[j].lng - coordinates[i].lng) * Math.PI / 180;

    area += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  area = Math.abs(area * R * R / 2);
  return area;
}

/**
 * Validate polygon and return errors and area
 * This is the function used by usePolygonDrawing hook
 */
export function validatePolygonForDrawing(coordinates: Array<{ lat: number; lng: number }>): {
  errors: ValidationError[];
  area: number;
} {
  const errors: ValidationError[] = [];

  if (!Array.isArray(coordinates)) {
    errors.push({ type: 'shape', message: 'Invalid polygon format' });
    return { errors, area: 0 };
  }

  if (coordinates.length < 3) {
    errors.push({ type: 'shape', message: 'Polygon must have at least 3 points' });
    return { errors, area: 0 };
  }

  // Validate each coordinate
  for (let i = 0; i < coordinates.length; i++) {
    const coord = coordinates[i];
    if (!coord || typeof coord !== 'object') {
      errors.push({ type: 'shape', message: `Invalid coordinate at point ${i + 1}` });
      continue;
    }

    const lat = coord.lat;
    const lng = coord.lng;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      errors.push({ type: 'shape', message: `Coordinate ${i + 1} must have numeric lat and lng` });
      continue;
    }

    // Validate latitude range
    if (lat < -90 || lat > 90) {
      errors.push({ type: 'bounds', message: `Latitude out of range at point ${i + 1}` });
    }

    // Validate longitude range
    if (lng < -180 || lng > 180) {
      errors.push({ type: 'bounds', message: `Longitude out of range at point ${i + 1}` });
    }

    // Check for NaN or Infinity
    if (!isFinite(lat) || !isFinite(lng)) {
      errors.push({ type: 'shape', message: `Invalid coordinate values at point ${i + 1}` });
    }
  }

  // Calculate area
  const area = calculatePolygonArea(coordinates);

  // Check minimum area
  if (area < 400) {
    errors.push({ type: 'size', message: 'Polygon area too small (minimum 400 m²)' });
  }

  // Check maximum area (10 km²)
  if (area > 10_000_000) {
    errors.push({ type: 'size', message: 'Polygon area too large (maximum 10 km²)' });
  }

  return { errors, area };
}
