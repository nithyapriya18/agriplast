/**
 * Geographic and coordinate conversion utilities
 */

import { Coordinate, Point } from '@shared/types';

/**
 * Convert geographic coordinates to local grid coordinates
 * Uses a simple equirectangular projection relative to centroid
 */
export function convertCoordinatesToLocalGrid(coordinates: Coordinate[]): Point[] {
  if (coordinates.length === 0) return [];

  // Calculate centroid
  const centroid = {
    lat: coordinates.reduce((sum, c) => sum + c.lat, 0) / coordinates.length,
    lng: coordinates.reduce((sum, c) => sum + c.lng, 0) / coordinates.length,
  };

  // Convert to local grid with centroid at origin
  return coordinates.map(coord => ({
    x: (coord.lng - centroid.lng) * 111320 * Math.cos(centroid.lat * Math.PI / 180),
    y: (coord.lat - centroid.lat) * 111320,
  }));
}

/**
 * Convert local grid coordinates back to geographic coordinates
 */
export function convertLocalToCoordinates(
  points: Point[],
  centroid: Coordinate
): Coordinate[] {
  return points.map(point => ({
    lat: centroid.lat + point.y / 111320,
    lng: centroid.lng + point.x / (111320 * Math.cos(centroid.lat * Math.PI / 180)),
  }));
}

/**
 * Calculate distance between two coordinates in meters
 */
export function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = coord1.lat * Math.PI / 180;
  const φ2 = coord2.lat * Math.PI / 180;
  const Δφ = (coord2.lat - coord1.lat) * Math.PI / 180;
  const Δλ = (coord2.lng - coord1.lng) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate bearing between two coordinates in degrees
 */
export function calculateBearing(coord1: Coordinate, coord2: Coordinate): number {
  const φ1 = coord1.lat * Math.PI / 180;
  const φ2 = coord2.lat * Math.PI / 180;
  const Δλ = (coord2.lng - coord1.lng) * Math.PI / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return (θ * 180 / Math.PI + 360) % 360;
}

/**
 * Calculate area of a polygon in square meters using Shoelace formula
 */
export function calculatePolygonArea(coordinates: Coordinate[]): number {
  if (coordinates.length < 3) return 0;

  let area = 0;
  const points = convertCoordinatesToLocalGrid(coordinates);

  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area / 2);
}

/**
 * Check if a point is inside a polygon
 */
export function isPointInPolygon(point: Coordinate, polygon: Coordinate[]): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;

    const intersect = ((yi > point.lat) !== (yj > point.lat))
      && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}
