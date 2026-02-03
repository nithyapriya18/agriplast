'use client';

import React, { useState } from 'react';
import { Circle, InfoWindow } from '@react-google-maps/api';

interface UnbuildableRegion {
  lat: number;
  lng: number;
  reason: string;
  type: 'unbuildable';
}

interface BuildableOverlayProps {
  regions: UnbuildableRegion[];
  visible?: boolean;
}

export function BuildableOverlay({ regions, visible = true }: BuildableOverlayProps) {
  const [hoveredRegion, setHoveredRegion] = useState<UnbuildableRegion | null>(null);

  if (!visible || !regions || regions.length === 0) return null;

  // Only show unbuildable regions (red zones for slopes, water, etc.)
  const unbuildableRegions = regions.filter(r => r.type === 'unbuildable');

  return (
    <>
      {unbuildableRegions.map((region, index) => (
        <Circle
          key={`unbuildable-${index}`}
          center={{ lat: region.lat, lng: region.lng }}
          radius={3}  // 3 meter radius
          options={{
            fillColor: '#ef4444',
            fillOpacity: 0.6,
            strokeColor: '#dc2626',
            strokeWeight: 0,
            clickable: true,
          }}
          onMouseOver={() => setHoveredRegion(region)}
          onMouseOut={() => setHoveredRegion(null)}
        />
      ))}
      
      {/* Info window for hovered region */}
      {hoveredRegion && hoveredRegion.lat && hoveredRegion.lng && (
        <InfoWindow
          position={{ lat: hoveredRegion.lat, lng: hoveredRegion.lng }}
          options={{
            pixelOffset: new google.maps.Size(0, -10),
          }}
          onCloseClick={() => setHoveredRegion(null)}
        >
          <div className="p-2">
            <div className="text-sm font-semibold text-red-600 mb-1">
              Unbuildable
            </div>
            <div className="text-xs text-gray-600">
              {hoveredRegion.reason}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}
