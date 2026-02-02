/**
 * Terrain Analysis Service
 * Integrates with Copernicus satellite data (DEM, Land Cover) for real terrain analysis
 * Provides elevation, slope, water body, and vegetation detection
 */

import { Coordinate } from '@shared/types';
import { CopernicusAPI } from './copernicusAPI';
import { OpenStreetMapService, OSMRoad, OSMBuilding, OSMWater, OSMForest } from './openstreetmap';
import * as turf from '@turf/turf';

export interface TerrainPoint {
  coordinate: Coordinate;
  elevation: number; // meters above sea level
  slope: number; // degrees
  landCover: LandCoverType;
  buildable: boolean;
  restrictions: string[];
}

export enum LandCoverType {
  CROPLAND = 'cropland',
  GRASSLAND = 'grassland',
  BARE_SOIL = 'bare_soil',
  WATER = 'water',
  WETLAND = 'wetland',
  URBAN = 'urban',
  BUILT_UP = 'built_up', // Roads, buildings, infrastructure (ESA class 50)
  FOREST = 'forest',
  SHRUBLAND = 'shrubland',
  PERMANENT_WATER = 'permanent_water',
  SEASONAL_WATER = 'seasonal_water',
}

export interface TerrainAnalysisResult {
  buildableArea: number; // sqm
  restrictedAreas: RestrictedZone[];
  averageSlope: number;
  elevationRange: { min: number; max: number };
  warnings: string[];
  terrainGrid: TerrainPoint[];
}

export interface RestrictedZone {
  type: 'water' | 'steep_slope' | 'vegetation' | 'wetland' | 'forest' | 'built_up' | 'road';
  coordinates: Coordinate[];
  area: number;
  reason: string;
  severity: 'prohibited' | 'challenging' | 'warning';
}

export class TerrainAnalysisService {
  private copernicusAPI: CopernicusAPI;
  private osmService: OpenStreetMapService;

  constructor() {
    this.copernicusAPI = new CopernicusAPI();
    this.osmService = new OpenStreetMapService();
  }

  /**
   * Analyze terrain for a land area
   * Fetches Copernicus satellite data and performs comprehensive analysis
   */
  async analyzeTerrain(
    coordinates: Coordinate[],
    options: {
      resolution?: 'low' | 'medium' | 'high'; // sampling density
      includeVegetation?: boolean;
      includeWaterBodies?: boolean;
      slopeThreshold?: number; // degrees
    } = {}
  ): Promise<TerrainAnalysisResult> {
    const {
      resolution = 'medium',
      includeVegetation = true,
      includeWaterBodies = true,
      slopeThreshold = 15,
    } = options;

    console.log(`🌍 Starting terrain analysis (${resolution} resolution)...`);

    // Calculate sampling grid based on resolution
    const samplingPoints = this.generateSamplingGrid(coordinates, resolution);
    console.log(`  Analyzing ${samplingPoints.length} terrain points...`);

    // Fetch OSM data (MUCH faster than satellite imagery - 1-2 seconds vs 30+ seconds)
    // Buildings are NOT restricted - owner can demolish them
    // Only restrict: roads (govt), water bodies, and forests
    const { roads, water, forests } = await this.osmService.fetchRoadsAndBuildings(coordinates);

    // Optionally fetch elevation data for slopes (can skip to speed up further)
    const elevationData = new Map<string, number>(); // Skip elevation for speed
    // If you need slopes, uncomment: await this.fetchElevationData(samplingPoints);

    // Build terrain grid with all data
    const terrainGrid: TerrainPoint[] = [];
    const warnings: string[] = [];
    const restrictedZones: RestrictedZone[] = [];
    let buildableCount = 0;

    for (const point of samplingPoints) {
      const elevation = 0; // Skip elevation for speed
      const slope = 0; // Skip slope calculation for speed

      // Determine buildability using FAST OSM data
      // Only restrict: water bodies, forests, and roads (government infrastructure)
      // Buildings can be demolished by owner
      const restrictions: string[] = [];
      let buildable = true;
      let landCover = LandCoverType.CROPLAND; // Default

      // Check if point is on a road (with 2m buffer)
      // Roads are government property and cannot be demolished
      if (this.osmService.isPointNearRoad(point, roads, 2)) {
        restrictions.push(`Road detected - government infrastructure`);
        buildable = false;
        landCover = LandCoverType.BUILT_UP;
      }

      // Check if point is in water (with 5m buffer for waterways)
      if (this.osmService.isPointInWater(point, water, 5)) {
        restrictions.push(`Water body detected - cannot build on water`);
        buildable = false;
        landCover = LandCoverType.WATER;
      }

      // Check if point is in forest area
      if (this.osmService.isPointInForest(point, forests)) {
        restrictions.push(`Forest area detected - protected vegetation`);
        buildable = false;
        landCover = LandCoverType.FOREST;
      }

      if (buildable) buildableCount++;

      terrainGrid.push({
        coordinate: point,
        elevation,
        slope,
        landCover,
        buildable,
        restrictions,
      });
    }

    // Create restricted zones directly from OSM geometries (more accurate than clustering sample points)
    // Clip them to land boundary to avoid zones extending outside the selected area
    const clusteredRestrictions = this.createRestrictedZonesFromOSM(roads, water, forests, coordinates);

    // Calculate statistics
    const elevations = terrainGrid.map(p => p.elevation);
    const slopes = terrainGrid.map(p => p.slope);
    const avgSlope = slopes.reduce((sum, s) => sum + s, 0) / slopes.length;

    // Generate warnings for restricted features
    const roadPointsCount = terrainGrid.filter(p => this.isBuiltUp(p.landCover)).length;
    const waterPointsCount = terrainGrid.filter(p => this.isWaterBody(p.landCover)).length;
    const forestPointsCount = terrainGrid.filter(p => p.landCover === LandCoverType.FOREST).length;

    if (roads.length > 0) {
      warnings.push(`${roads.length} roads detected (government infrastructure)`);
    }

    if (water.length > 0) {
      warnings.push(`${water.length} water bodies detected`);
    }

    if (forests.length > 0) {
      warnings.push(`${forests.length} forest areas detected`);
    }

    if (roadPointsCount > samplingPoints.length * 0.05) {
      warnings.push(`${(roadPointsCount / samplingPoints.length * 100).toFixed(0)}% of area covered by roads`);
    }

    if (waterPointsCount > samplingPoints.length * 0.05) {
      warnings.push(`${(waterPointsCount / samplingPoints.length * 100).toFixed(0)}% of area covered by water`);
    }

    if (forestPointsCount > samplingPoints.length * 0.05) {
      warnings.push(`${(forestPointsCount / samplingPoints.length * 100).toFixed(0)}% of area covered by forests`);
    }

    const buildablePercentage = (buildableCount / samplingPoints.length * 100).toFixed(1);
    console.log(`✓ Terrain analysis complete: ${buildablePercentage}% buildable`);

    return {
      buildableArea: buildableCount / samplingPoints.length, // percentage as 0-1
      restrictedAreas: clusteredRestrictions,
      averageSlope: avgSlope,
      elevationRange: {
        min: Math.min(...elevations),
        max: Math.max(...elevations),
      },
      warnings,
      terrainGrid,
    };
  }

  /**
   * Generate sampling grid for terrain analysis
   */
  private generateSamplingGrid(
    boundary: Coordinate[],
    resolution: 'low' | 'medium' | 'high'
  ): Coordinate[] {
    // Calculate bounding box
    const lats = boundary.map(c => c.lat);
    const lngs = boundary.map(c => c.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Determine grid spacing based on resolution
    // Copernicus DEM is 30m resolution, so sample at appropriate intervals
    const spacing = {
      low: 0.0005,    // ~50m between points
      medium: 0.0003, // ~30m between points (matches DEM resolution)
      high: 0.0001,   // ~10m between points (matches land cover resolution)
    }[resolution];

    const points: Coordinate[] = [];

    // Generate regular grid
    for (let lat = minLat; lat <= maxLat; lat += spacing) {
      for (let lng = minLng; lng <= maxLng; lng += spacing) {
        const point = { lat, lng };

        // Check if point is inside boundary polygon
        if (this.isPointInPolygon(point, boundary)) {
          points.push(point);
        }
      }
    }

    return points;
  }

  /**
   * Fetch elevation data from Copernicus DEM (with caching)
   */
  private async fetchElevationData(points: Coordinate[]): Promise<Map<string, number>> {
    console.log(`  Fetching elevation data for ${points.length} points...`);
    return await this.copernicusAPI.fetchElevation(points);
  }

  /**
   * Fetch land cover data from Copernicus WorldCover (with caching)
   */
  private async fetchLandCoverData(points: Coordinate[]): Promise<Map<string, LandCoverType>> {
    console.log(`  Fetching land cover data for ${points.length} points...`);
    return await this.copernicusAPI.fetchLandCover(points);
  }

  /**
   * Simulate elevation data (for development/testing)
   * Generates realistic elevation with some variation and slopes
   */
  private simulateElevationData(points: Coordinate[]): Map<string, number> {
    const elevationMap = new Map<string, number>();

    // Base elevation around 100m with variation
    const baseElevation = 100;

    for (const point of points) {
      // Create some terrain variation using coordinate-based noise
      const noise = Math.sin(point.lat * 1000) * 5 + Math.cos(point.lng * 1000) * 5;
      const elevation = baseElevation + noise + (Math.random() - 0.5) * 10;

      elevationMap.set(this.coordKey(point), elevation);
    }

    return elevationMap;
  }

  /**
   * Simulate land cover data (for development/testing)
   */
  private simulateLandCoverData(points: Coordinate[]): Map<string, LandCoverType> {
    const landCoverMap = new Map<string, LandCoverType>();

    for (const point of points) {
      // Mostly cropland, with some variation
      const rand = Math.random();
      let landCover: LandCoverType;

      if (rand < 0.75) {
        landCover = LandCoverType.CROPLAND;
      } else if (rand < 0.85) {
        landCover = LandCoverType.GRASSLAND;
      } else if (rand < 0.90) {
        landCover = LandCoverType.BARE_SOIL;
      } else if (rand < 0.95) {
        landCover = LandCoverType.SHRUBLAND;
      } else if (rand < 0.98) {
        landCover = LandCoverType.WATER;
      } else {
        landCover = LandCoverType.FOREST;
      }

      landCoverMap.set(this.coordKey(point), landCover);
    }

    return landCoverMap;
  }

  /**
   * Calculate slope at a point using neighboring elevation data
   */
  private calculateSlope(
    point: Coordinate,
    elevationData: Map<string, number>,
    allPoints: Coordinate[]
  ): number {
    const elevation = elevationData.get(this.coordKey(point));
    if (!elevation) return 0;

    // Find nearest neighbors
    const neighbors = allPoints
      .filter(p => {
        const dist = this.distance(point, p);
        return dist > 0 && dist < 0.0005; // ~50m radius
      })
      .slice(0, 4); // Take 4 nearest neighbors

    if (neighbors.length === 0) return 0;

    // Calculate average elevation difference
    let maxDiff = 0;
    for (const neighbor of neighbors) {
      const neighborElev = elevationData.get(this.coordKey(neighbor)) || elevation;
      const elevDiff = Math.abs(neighborElev - elevation);
      const horizontalDist = this.distance(point, neighbor) * 111320; // degrees to meters

      if (horizontalDist > 0) {
        const slope = Math.atan(elevDiff / horizontalDist) * (180 / Math.PI);
        maxDiff = Math.max(maxDiff, slope);
      }
    }

    return maxDiff;
  }

  /**
   * Check if land cover is a water body
   */
  private isWaterBody(landCover: LandCoverType): boolean {
    return landCover === LandCoverType.WATER ||
           landCover === LandCoverType.PERMANENT_WATER ||
           landCover === LandCoverType.SEASONAL_WATER ||
           landCover === LandCoverType.WETLAND;
  }

  /**
   * Check if land cover is built-up area (roads, buildings, infrastructure)
   */
  private isBuiltUp(landCover: LandCoverType): boolean {
    return landCover === LandCoverType.BUILT_UP ||
           landCover === LandCoverType.URBAN;
  }

  /**
   * Check if land cover is dense vegetation
   */
  private isDenseVegetation(landCover: LandCoverType): boolean {
    return landCover === LandCoverType.FOREST ||
           landCover === LandCoverType.SHRUBLAND;
  }

  /**
   * Create restricted zones directly from OSM geometries (more accurate than clustering)
   * Clips all zones to land boundary to avoid extending outside selected area
   */
  private createRestrictedZonesFromOSM(
    roads: OSMRoad[],
    water: OSMWater[],
    forests: OSMForest[],
    landBoundary: Coordinate[]
  ): RestrictedZone[] {
    const zones: RestrictedZone[] = [];

    // Create land boundary polygon for clipping
    const landPolygon = turf.polygon([landBoundary.map(c => [c.lng, c.lat])]);

    // Create road zones with buffers
    for (const road of roads) {
      if (road.coordinates.length < 2) continue;

      try {
        // Create a buffer around the road (2m on each side = 4m total width)
        const roadLine = turf.lineString(road.coordinates.map(c => [c.lng, c.lat]));
        const buffered = turf.buffer(roadLine, 0.002, { units: 'kilometers' }); // 2m buffer

        if (buffered && buffered.geometry && buffered.geometry.coordinates && buffered.geometry.coordinates[0]) {
          // Clip the buffered road to land boundary
          try {
            const clipped = turf.intersect(turf.featureCollection([buffered, landPolygon]));

            if (clipped && clipped.geometry && clipped.geometry.coordinates && clipped.geometry.coordinates[0]) {
              const coords = clipped.geometry.coordinates[0].map((c: number[]) => ({
                lat: c[1],
                lng: c[0],
              }));

              if (coords.length >= 3) {
                zones.push({
                  type: 'road',
                  coordinates: coords.slice(0, -1), // Remove closing coordinate
                  area: road.coordinates.length, // Approximate
                  reason: `Road: ${road.name || road.highway} - government infrastructure`,
                  severity: 'prohibited',
                });
              }
            }
          } catch (clipError) {
            // If clipping fails, skip this road (it doesn't intersect the land)
          }
        }
      } catch (error) {
        console.warn(`Failed to create buffer for road:`, error);
      }
    }

    // Create water zones
    for (const waterBody of water) {
      if (waterBody.coordinates.length < 3) continue;

      try {
        // For water polygons, use them directly with small buffer
        let buffered;
        if (waterBody.coordinates.length >= 3) {
          const waterPolygon = turf.polygon([waterBody.coordinates.map(c => [c.lng, c.lat])]);
          buffered = turf.buffer(waterPolygon, 0.005, { units: 'kilometers' }); // 5m buffer
        } else {
          // For waterways (lines), create buffer
          const waterLine = turf.lineString(waterBody.coordinates.map(c => [c.lng, c.lat]));
          buffered = turf.buffer(waterLine, 0.005, { units: 'kilometers' }); // 5m buffer
        }

        if (buffered && buffered.geometry && buffered.geometry.coordinates && buffered.geometry.coordinates[0]) {
          // Clip the buffered water to land boundary
          try {
            const clipped = turf.intersect(turf.featureCollection([buffered, landPolygon]));

            if (clipped && clipped.geometry && clipped.geometry.coordinates && clipped.geometry.coordinates[0]) {
              const coords = clipped.geometry.coordinates[0].map((c: number[]) => ({
                lat: c[1],
                lng: c[0],
              }));

              if (coords.length >= 3) {
                zones.push({
                  type: 'water',
                  coordinates: coords.slice(0, -1), // Remove closing coordinate
                  area: waterBody.coordinates.length,
                  reason: `Water body: ${waterBody.name || waterBody.waterType}`,
                  severity: 'prohibited',
                });
              }
            }
          } catch (clipError) {
            // If clipping fails, skip this water body
          }
        }
      } catch (error) {
        console.warn(`Failed to create buffer for water body:`, error);
      }
    }

    // Create forest zones
    for (const forest of forests) {
      if (forest.coordinates.length < 3) continue;

      try {
        const forestPolygon = turf.polygon([forest.coordinates.map(c => [c.lng, c.lat])]);

        // Clip forest to land boundary
        try {
          const clipped = turf.intersect(turf.featureCollection([forestPolygon, landPolygon]));

          if (clipped && clipped.geometry && clipped.geometry.coordinates && clipped.geometry.coordinates[0]) {
            const coords = clipped.geometry.coordinates[0].map((c: number[]) => ({
              lat: c[1],
              lng: c[0],
            }));

            if (coords.length >= 3) {
              zones.push({
                type: 'forest',
                coordinates: coords.slice(0, -1), // Remove closing coordinate
                area: forest.coordinates.length,
                reason: `Forest: ${forest.name || forest.forestType} - protected vegetation`,
                severity: 'prohibited',
              });
            }
          }
        } catch (clipError) {
          // If clipping fails, skip this forest
        }
      } catch (error) {
        console.warn(`Failed to create forest zone:`, error);
      }
    }

    console.log(`\n📍 RESTRICTED ZONES FROM OSM:`);
    console.log(`   Total zones: ${zones.length} (${roads.length} roads, ${water.length} water bodies, ${forests.length} forests)`);
    zones.forEach((zone, i) => {
      console.log(`   Zone ${i + 1}: ${zone.type} - ${zone.reason}`);
    });

    return zones;
  }

  /**
   * Cluster adjacent restricted areas into zones with proper polygon boundaries
   * DEPRECATED: Using direct OSM geometries now for better accuracy
   */
  private clusterRestrictedAreas(
    restrictedPoints: TerrainPoint[],
    boundary: Coordinate[]
  ): RestrictedZone[] {
    const zones: RestrictedZone[] = [];

    // Detect water zones
    const waterPoints = restrictedPoints.filter(p => this.isWaterBody(p.landCover));

    // Detect built-up areas (roads only - buildings can be demolished)
    const builtUpPoints = restrictedPoints.filter(p => this.isBuiltUp(p.landCover));

    // Detect forest areas
    const forestPoints = restrictedPoints.filter(p => p.landCover === LandCoverType.FOREST);

    // Helper function to create polygon from scattered points
    const createZonePolygon = (points: TerrainPoint[]): Coordinate[] => {
      if (points.length === 0) return [];
      if (points.length === 1) {
        // Single point - create small square around it (10m x 10m)
        const p = points[0].coordinate;
        const offset = 0.00009; // ~10m in degrees
        return [
          { lat: p.lat - offset, lng: p.lng - offset },
          { lat: p.lat + offset, lng: p.lng - offset },
          { lat: p.lat + offset, lng: p.lng + offset },
          { lat: p.lat - offset, lng: p.lng + offset },
        ];
      }
      if (points.length === 2) {
        // Two points - create rectangle between them
        const p1 = points[0].coordinate;
        const p2 = points[1].coordinate;
        const offset = 0.00009; // ~10m perpendicular offset
        return [
          { lat: p1.lat - offset, lng: p1.lng - offset },
          { lat: p1.lat + offset, lng: p1.lng + offset },
          { lat: p2.lat + offset, lng: p2.lng + offset },
          { lat: p2.lat - offset, lng: p2.lng - offset },
        ];
      }

      // For 3+ points, use convex hull to create polygon
      try {
        const turfPoints = turf.featureCollection(
          points.map(p => turf.point([p.coordinate.lng, p.coordinate.lat]))
        );
        const hull = turf.convex(turfPoints);

        if (hull && hull.geometry && hull.geometry.coordinates && hull.geometry.coordinates[0]) {
          // Convert turf coordinates back to our format
          const coords = hull.geometry.coordinates[0].map((c: number[]) => ({
            lat: c[1],
            lng: c[0],
          }));
          // Remove the closing coordinate that turf adds
          return coords.slice(0, -1);
        }
      } catch (error) {
        console.warn('Failed to create convex hull, using point buffer instead:', error);
      }

      // Fallback: just use the points as-is
      return points.map(p => p.coordinate);
    };

    // Create water zones
    if (waterPoints.length > 0) {
      const polygon = createZonePolygon(waterPoints);
      if (polygon.length >= 3) {
        console.log(`🌊 Created water zone with ${polygon.length} vertices from ${waterPoints.length} sample points`);
        zones.push({
          type: 'water',
          coordinates: polygon,
          area: waterPoints.length,
          reason: 'Water body detected - cannot build on water',
          severity: 'prohibited',
        });
      }
    }

    // Create road zones (only roads, not buildings - buildings can be demolished)
    if (builtUpPoints.length > 0) {
      const polygon = createZonePolygon(builtUpPoints);
      if (polygon.length >= 3) {
        console.log(`🛣️  Created road zone with ${polygon.length} vertices from ${builtUpPoints.length} sample points`);
        zones.push({
          type: 'road',
          coordinates: polygon,
          area: builtUpPoints.length,
          reason: 'Roads - government infrastructure cannot be demolished',
          severity: 'prohibited',
        });
      }
    }

    // Create forest zones
    if (forestPoints.length > 0) {
      const polygon = createZonePolygon(forestPoints);
      if (polygon.length >= 3) {
        console.log(`🌲 Created forest zone with ${polygon.length} vertices from ${forestPoints.length} sample points`);
        zones.push({
          type: 'forest',
          coordinates: polygon,
          area: forestPoints.length,
          reason: 'Forest area - protected vegetation',
          severity: 'prohibited',
        });
      }
    }

    console.log(`\n📍 RESTRICTED ZONES SUMMARY:`);
    console.log(`   Total zones: ${zones.length} (water, forests, and roads - buildings can be demolished)`);
    zones.forEach((zone, i) => {
      console.log(`   Zone ${i + 1}: ${zone.type} - ${zone.severity} - ${zone.coordinates.length} vertices (from ${zone.area} sample points)`);
    });

    return zones;
  }

  /**
   * Check if point is inside polygon
   */
  private isPointInPolygon(point: Coordinate, polygon: Coordinate[]): boolean {
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

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private distance(c1: Coordinate, c2: Coordinate): number {
    const dLat = Math.abs(c1.lat - c2.lat);
    const dLng = Math.abs(c1.lng - c2.lng);
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }

  /**
   * Generate unique key for coordinate
   */
  private coordKey(coord: Coordinate): string {
    return `${coord.lat.toFixed(6)},${coord.lng.toFixed(6)}`;
  }
}
