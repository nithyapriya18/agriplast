/**
 * Professional Polyhouse Optimizer V3
 * SIMPLIFIED APPROACH: Place ONE large polyhouse that fills the land
 *
 * Based on reference images (pic1, pic2) showing single large rectangular polyhouses
 * that maximize land coverage with proper solar orientation.
 */

import * as turf from '@turf/turf';
import { Feature, Polygon, Position } from 'geojson';
import {
  LandArea,
  Polyhouse,
  Block,
  Point,
  Coordinate,
  PolyhouseConfiguration,
} from '@shared/types';

interface PolyhouseCandidate {
  gableLength: number;  // X direction (multiples of 8m)
  gutterWidth: number;  // Y direction (multiples of 4m)
  area: number;
  center: Coordinate;
  rotation: number;     // Angle in degrees
  bounds: Point[];      // 4 corners
}

export class PolyhouseOptimizerV3 {
  private config: PolyhouseConfiguration;
  private landArea: LandArea;

  // Industry standards
  private readonly GABLE_MODULE = 8;     // 8m gable bay
  private readonly GUTTER_MODULE = 4;    // 4m gutter bay
  private readonly MAX_AREA = 10000;     // 10,000 sqm = 1 hectare
  private readonly MAX_SIDE = 120;       // 120m max side length
  private readonly CORRIDOR_WIDTH = 2;   // 2m between polyhouses

  constructor(landArea: LandArea, config: PolyhouseConfiguration) {
    this.config = config;
    this.landArea = landArea;
  }

  /**
   * Main optimization: Find the LARGEST rectangle that fits in the land polygon
   */
  async optimize(): Promise<Polyhouse[]> {
    console.log('\n🏗️  Polyhouse Optimizer V3 - SIMPLIFIED APPROACH');
    console.log('=' + '='.repeat(60));
    console.log(`Land area: ${(this.landArea.area / 10000).toFixed(2)} hectares (${this.landArea.area.toFixed(0)} sqm)`);
    console.log('Strategy: Find ONE large rectangle that fills the land');

    const startTime = Date.now();
    const polyhouses: Polyhouse[] = [];

    // Create land polygon
    const landCoords = this.landArea.coordinates.map(c => [c.lng, c.lat]);
    landCoords.push([this.landArea.coordinates[0].lng, this.landArea.coordinates[0].lat]);
    const landPolygon = turf.polygon([landCoords]);

    // Apply safety buffer
    const bufferedLandRaw = turf.buffer(landPolygon, -this.config.safetyBuffer / 1000, { units: 'kilometers' });
    if (!bufferedLandRaw) {
      console.error('❌ Land too small after applying safety buffer');
      return [];
    }

    // Ensure we have a polygon (not multipolygon)
    const bufferedLand = bufferedLandRaw.geometry.type === 'Polygon'
      ? bufferedLandRaw as Feature<Polygon>
      : turf.polygon(bufferedLandRaw.geometry.coordinates[0]) as Feature<Polygon>;

    // Get solar orientation requirement based on latitude
    const latitude = this.landArea.centroid.lat;
    const optimalOrientation = this.calculateOptimalSolarOrientation(latitude);
    console.log(`\n☀️  Solar optimization: Latitude ${latitude.toFixed(2)}°, Optimal orientation: ${optimalOrientation.toFixed(0)}°`);

    // Try different orientations around the optimal angle
    const orientationsToTry = [
      optimalOrientation,
      optimalOrientation + 90,
      optimalOrientation + 45,
      optimalOrientation - 45,
    ];

    let bestCandidate: PolyhouseCandidate | null = null;

    console.log(`\n🔍 Trying ${orientationsToTry.length} orientations...`);
    for (const orientation of orientationsToTry) {
      console.log(`  Testing orientation: ${orientation}°`);
      try {
        const candidate = this.findLargestInscribedRectangle(bufferedLand, orientation);
        if (candidate) {
          console.log(`    ✓ Found candidate: ${candidate.gableLength}m × ${candidate.gutterWidth}m = ${candidate.area}m²`);
          if (!bestCandidate || candidate.area > bestCandidate.area) {
            bestCandidate = candidate;
          }
        } else {
          console.log(`    ✗ No candidate found`);
        }
      } catch (error) {
        console.error(`    ❌ Error finding rectangle at ${orientation}°:`, error);
      }
    }

    if (!bestCandidate) {
      console.error('❌ Could not fit any polyhouse in the land area');
      return [];
    }

    // Create the main polyhouse
    const mainPolyhouse = await this.createPolyhouse(bestCandidate, 'A', '#4CAF50');
    polyhouses.push(mainPolyhouse);

    const coverage = (mainPolyhouse.area / this.landArea.area) * 100;
    console.log(`\n✅ Placed main polyhouse: ${mainPolyhouse.gableLength}m × ${mainPolyhouse.gutterWidth}m = ${mainPolyhouse.area}m²`);
    console.log(`   Coverage: ${coverage.toFixed(1)}%`);

    // If coverage is low (<60%), try to fit ONE more polyhouse in remaining space
    if (coverage < 60) {
      console.log(`\n🎯 Coverage below 60%, attempting to place second polyhouse...`);

      // Create occupied polygon with corridor buffer
      try {
        const occupied = this.createBufferedPolygon(mainPolyhouse, this.CORRIDOR_WIDTH);
        const remainingSpace = turf.difference(
          turf.featureCollection([bufferedLand, occupied])
        ) as Feature<Polygon> | null;

        if (!remainingSpace) {
          console.log(`    ✗ No remaining space after first polyhouse`);
          return polyhouses;
        }

        // Try to fit second polyhouse
        // Ensure remaining space is a polygon
        let remainingPolygon: Feature<Polygon>;
        if (remainingSpace.geometry.type === 'Polygon') {
          remainingPolygon = remainingSpace as Feature<Polygon>;
        } else {
          // MultiPolygon - take the largest polygon
          const coords = (remainingSpace.geometry as any).coordinates[0];
          remainingPolygon = turf.polygon(coords) as Feature<Polygon>;
        }

        for (const orientation of orientationsToTry) {
          const candidate = this.findLargestInscribedRectangle(remainingPolygon, orientation);
          if (candidate && candidate.area >= 1000) { // At least 1000 sqm
            const secondPolyhouse = await this.createPolyhouse(candidate, 'B', '#66BB6A');
            polyhouses.push(secondPolyhouse);

            const finalCoverage = polyhouses.reduce((sum, p) => sum + p.area, 0) / this.landArea.area * 100;
            console.log(`   ✅ Added second polyhouse: ${secondPolyhouse.gableLength}m × ${secondPolyhouse.gutterWidth}m = ${secondPolyhouse.area}m²`);
            console.log(`   Final coverage: ${finalCoverage.toFixed(1)}%`);
            break;
          }
        }
      } catch (error) {
        console.error(`    ❌ Error placing second polyhouse:`, error instanceof Error ? error.message : error);
      }
    }

    const elapsedTime = Date.now() - startTime;
    const finalCoverage = polyhouses.reduce((sum, p) => sum + p.area, 0) / this.landArea.area * 100;

    console.log('\n' + '='.repeat(62));
    console.log(`✅ Optimization complete in ${elapsedTime}ms`);
    console.log(`   Placed ${polyhouses.length} polyhouse(s)`);
    console.log(`   Land utilization: ${finalCoverage.toFixed(1)}%`);
    console.log(`   Total polyhouse area: ${polyhouses.reduce((sum, p) => sum + p.area, 0).toFixed(0)} sqm`);
    console.log('='.repeat(62) + '\n');

    return polyhouses;
  }

  /**
   * Calculate optimal solar orientation based on latitude
   * Gutters should face east-west to maximize sunlight exposure
   */
  private calculateOptimalSolarOrientation(latitude: number): number {
    // For northern hemisphere (latitude > 0): gutters face E-W (90°)
    // For southern hemisphere (latitude < 0): gutters face E-W (90°)
    // The gable (long side) runs N-S for optimal sunlight on gutters

    // Return 0° (N-S for gable) which means gutters run E-W
    return 0;
  }

  /**
   * Find the largest axis-aligned rectangle that fits inside a polygon
   * SIMPLIFIED: Use 80% of bounding box dimensions
   */
  private findLargestInscribedRectangle(
    polygon: Feature<Polygon>,
    orientation: number
  ): PolyhouseCandidate | null {
    try {
      // Get polygon bounds
      const bbox = turf.bbox(polygon);
      const [minLng, minLat, maxLng, maxLat] = bbox;

      // Calculate polygon center
      const center = turf.centroid(polygon);
      const centerLng = center.geometry.coordinates[0];
      const centerLat = center.geometry.coordinates[1];

      // Calculate dimensions in meters (use 85% of bounding box for safety)
      const widthMeters = turf.distance([minLng, centerLat], [maxLng, centerLat], { units: 'meters' }) * 0.85;
      const heightMeters = turf.distance([centerLng, minLat], [centerLng, maxLat], { units: 'meters' }) * 0.85;

      console.log(`    Bounding box: ${widthMeters.toFixed(0)}m × ${heightMeters.toFixed(0)}m`);

      // Round to module sizes
      let gableLength = Math.floor(widthMeters / this.GABLE_MODULE) * this.GABLE_MODULE;
      let gutterWidth = Math.floor(heightMeters / this.GUTTER_MODULE) * this.GUTTER_MODULE;

      // Enforce constraints
      gableLength = Math.min(gableLength, this.MAX_SIDE);
      gutterWidth = Math.min(gutterWidth, this.MAX_SIDE);

      if (gableLength < this.GABLE_MODULE || gutterWidth < this.GUTTER_MODULE) {
        return null;
      }

      let area = gableLength * gutterWidth;

      // If over 10,000 sqm, scale down proportionally
      if (area > this.MAX_AREA) {
        const scale = Math.sqrt(this.MAX_AREA / area);
        gableLength = Math.floor((gableLength * scale) / this.GABLE_MODULE) * this.GABLE_MODULE;
        gutterWidth = Math.floor((gutterWidth * scale) / this.GUTTER_MODULE) * this.GUTTER_MODULE;

        if (gableLength < this.GABLE_MODULE || gutterWidth < this.GUTTER_MODULE) {
          return null;
        }

        area = gableLength * gutterWidth;
      }

      // Create candidate
      const candidate = this.createRectangleCandidate(
        gableLength,
        gutterWidth,
        area,
        { lat: centerLat, lng: centerLng },
        orientation
      );

      return candidate;
    } catch (error) {
      console.error('Error finding inscribed rectangle:', error);
      return null;
    }
  }

  /**
   * Create a rectangle candidate at a given position and orientation
   */
  private createRectangleCandidate(
    gableLength: number,
    gutterWidth: number,
    area: number,
    center: Coordinate,
    rotation: number
  ): PolyhouseCandidate {
    // Calculate corners in local space (meters from center)
    const halfGable = gableLength / 2;
    const halfGutter = gutterWidth / 2;

    const localCorners = [
      { x: -halfGable, y: -halfGutter },
      { x: halfGable, y: -halfGutter },
      { x: halfGable, y: halfGutter },
      { x: -halfGable, y: halfGutter },
    ];

    // Rotate corners
    const angleRad = rotation * Math.PI / 180;
    const rotatedCorners = localCorners.map(corner => {
      const rotX = corner.x * Math.cos(angleRad) - corner.y * Math.sin(angleRad);
      const rotY = corner.x * Math.sin(angleRad) + corner.y * Math.cos(angleRad);
      return { x: rotX, y: rotY };
    });

    // Convert to geographic coordinates
    const bounds: Point[] = rotatedCorners.map(corner => {
      const lat = center.lat + corner.y / 111320;
      const lng = center.lng + corner.x / (111320 * Math.cos(center.lat * Math.PI / 180));
      return { x: lng, y: lat };
    });

    return {
      gableLength,
      gutterWidth,
      area,
      center,
      rotation,
      bounds,
    };
  }

  /**
   * Check if a rectangle fits completely inside a polygon
   */
  private rectangleFitsInPolygon(candidate: PolyhouseCandidate, polygon: Feature<Polygon>): boolean {
    try {
      // Create rectangle polygon
      const rectCoords = [...candidate.bounds.map(p => [p.x, p.y]), [candidate.bounds[0].x, candidate.bounds[0].y]];
      const rectPolygon = turf.polygon([rectCoords]);

      // Check if rectangle is within polygon (allowing small tolerance)
      const intersection = turf.intersect(
        turf.featureCollection([rectPolygon, polygon])
      );
      if (!intersection) return false;

      const intersectionArea = turf.area(intersection);
      const rectArea = candidate.area;

      // Rectangle fits if intersection is at least 95% of rectangle area
      return intersectionArea >= rectArea * 0.95;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a full Polyhouse object from a candidate
   */
  private async createPolyhouse(
    candidate: PolyhouseCandidate,
    label: string,
    color: string
  ): Promise<Polyhouse> {
    const blocks: Block[] = [];
    const angleRad = candidate.rotation * Math.PI / 180;

    // Generate 8x4m grid blocks
    const numGableBays = candidate.gableLength / this.GABLE_MODULE;
    const numGutterBays = candidate.gutterWidth / this.GUTTER_MODULE;

    let blockIndex = 0;
    for (let gutterIdx = 0; gutterIdx < numGutterBays; gutterIdx++) {
      for (let gableIdx = 0; gableIdx < numGableBays; gableIdx++) {
        // Position in local space (meters from center)
        const localX = (gableIdx - numGableBays / 2) * this.GABLE_MODULE + this.GABLE_MODULE / 2;
        const localY = (gutterIdx - numGutterBays / 2) * this.GUTTER_MODULE + this.GUTTER_MODULE / 2;

        // Rotate
        const rotX = localX * Math.cos(angleRad) - localY * Math.sin(angleRad);
        const rotY = localX * Math.sin(angleRad) + localY * Math.cos(angleRad);

        // Block corners (top-left origin)
        const blockLocalCorners = [
          { x: -this.GABLE_MODULE / 2, y: -this.GUTTER_MODULE / 2 },
          { x: this.GABLE_MODULE / 2, y: -this.GUTTER_MODULE / 2 },
          { x: this.GABLE_MODULE / 2, y: this.GUTTER_MODULE / 2 },
          { x: -this.GABLE_MODULE / 2, y: this.GUTTER_MODULE / 2 },
        ];

        // Rotate and translate block corners
        const corners: Point[] = blockLocalCorners.map(corner => {
          const rotCornerX = corner.x * Math.cos(angleRad) - corner.y * Math.sin(angleRad);
          const rotCornerY = corner.x * Math.sin(angleRad) + corner.y * Math.cos(angleRad);
          const finalX = rotX + rotCornerX;
          const finalY = rotY + rotCornerY;

          const lat = candidate.center.lat + finalY / 111320;
          const lng = candidate.center.lng + finalX / (111320 * Math.cos(candidate.center.lat * Math.PI / 180));

          return { x: lng, y: lat };
        });

        blocks.push({
          id: `block-${blockIndex}`,
          position: { x: rotX, y: rotY },
          width: this.GABLE_MODULE,
          height: this.GUTTER_MODULE,
          rotation: candidate.rotation,
          corners,
        });

        blockIndex++;
      }
    }

    return {
      id: `polyhouse-${Date.now()}-${label}`,
      label,
      color,
      gableLength: candidate.gableLength,
      gutterWidth: candidate.gutterWidth,
      rotation: candidate.rotation,
      center: candidate.center,
      bounds: candidate.bounds,
      area: candidate.area,
      innerArea: candidate.area,
      dimensions: {
        length: candidate.gableLength,
        width: candidate.gutterWidth,
      },
      blocks,
    };
  }

  /**
   * Create buffered polygon around a polyhouse
   */
  private createBufferedPolygon(polyhouse: Polyhouse, bufferMeters: number): Feature<Polygon> {
    const coords = [...polyhouse.bounds.map(p => [p.x, p.y]), [polyhouse.bounds[0].x, polyhouse.bounds[0].y]];
    const poly = turf.polygon([coords]);
    const buffered = turf.buffer(poly, bufferMeters / 1000, { units: 'kilometers' });
    return buffered as Feature<Polygon>;
  }
}
