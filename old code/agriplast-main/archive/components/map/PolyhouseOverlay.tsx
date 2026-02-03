'use client';

import React, { useState } from 'react';
import { Rectangle, InfoWindow } from '@react-google-maps/api';
import { COLORS, GREENHOUSE_SPEC } from '@/lib/constants';

interface Block {
  id: string;
  block_number?: number;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  center: {
    lat: number;
    lng: number;
  };
  elevation_m?: number;
  polyhouse_id?: string;
  polyhouse_name?: string;
  connections?: {
    angle_90: number;
    angle_180: number;
    angle_270: number;
  };
}

interface PolyhouseOverlayProps {
  polyhouses: Block[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export function PolyhouseOverlay({ 
  polyhouses, 
  selectedId,
  onSelect 
}: PolyhouseOverlayProps) {
  const [hoveredBlock, setHoveredBlock] = useState<Block | null>(null);

  // Safety check: ensure polyhouses is an array
  if (!Array.isArray(polyhouses)) {
    console.error('PolyhouseOverlay: polyhouses is not an array:', polyhouses);
    return null;
  }

  // Predefined high-contrast color palette
  const COLOR_PALETTE = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Sky Blue
    '#FFA07A', // Light Salmon
    '#98D8C8', // Mint
    '#FFD93D', // Yellow
    '#6BCF7F', // Green
    '#C780FA', // Purple
    '#FF8ED4', // Pink
    '#95E1D3', // Aqua
    '#F38181', // Coral
    '#AA96DA', // Lavender
    '#FCBAD3', // Light Pink
    '#A8D8EA', // Light Blue
    '#FFB6B9', // Pastel Red
    '#FFEAA7', // Pastel Yellow
    '#DFE6E9', // Light Gray
    '#74B9FF', // Dodger Blue
    '#FD79A8', // Hot Pink
    '#FDCB6E', // Orange
  ];

  // Create a mapping of unique polyhouse IDs to colors
  const getPolyhouseColor = (polyhouseId: string | undefined): string => {
    if (!polyhouseId) return COLORS.primary;
    
    // Get all unique polyhouse IDs
    const uniqueIds = Array.from(new Set(polyhouses.map(b => b.polyhouse_id).filter(Boolean)));
    const index = uniqueIds.indexOf(polyhouseId);
    
    if (index === -1) return COLORS.primary;
    
    // Use modulo to cycle through palette if more polyhouses than colors
    return COLOR_PALETTE[index % COLOR_PALETTE.length];
  };

  // Calculate gutter bounds (expand bounds by gutter border width)
  const calculateGutterBounds = (bounds: Block['bounds'], centerLat: number): Block['bounds'] => {
    // Convert meters to degrees
    // 1 degree latitude ≈ 111,000 meters
    // 1 degree longitude ≈ 111,000 * cos(latitude) meters
    const metersPerDegreeLat = 111000;
    const metersPerDegreeLng = 111000 * Math.cos((centerLat * Math.PI) / 180);
    
    const gutterMeters = GREENHOUSE_SPEC.GUTTER_BORDER_M;
    const latOffset = gutterMeters / metersPerDegreeLat;
    const lngOffset = gutterMeters / metersPerDegreeLng;
    
    return {
      north: bounds.north + latOffset,
      south: bounds.south - latOffset,
      east: bounds.east + lngOffset,
      west: bounds.west - lngOffset,
    };
  };

  return (
    <>
      {polyhouses.map((block) => {
        const isSelected = selectedId === block.id;
        const isHovered = hoveredBlock?.id === block.id;
        const blockColor = getPolyhouseColor(block.polyhouse_id);
        const centerLat = block.center.lat;
        const gutterBounds = calculateGutterBounds(block.bounds, centerLat);
        
        return (
          <React.Fragment key={block.id}>
            {/* Gutter border (2m black border around polyhouse) */}
            <Rectangle
              bounds={gutterBounds}
              options={{
                fillColor: 'transparent',
                fillOpacity: 0,
                strokeColor: '#000000', // Black color for gutter
                strokeWeight: 2,
                strokeOpacity: 1,
                clickable: false,
                zIndex: 1,
              }}
            />
            {/* Main polyhouse block */}
            <Rectangle
              bounds={block.bounds}
              options={{
                fillColor: isSelected 
                  ? COLORS.primary 
                  : blockColor,
                fillOpacity: isSelected ? 0.7 : isHovered ? 0.7 : 0.6,
                strokeColor: isSelected ? COLORS.text : blockColor,
                strokeWeight: isSelected ? 3 : 1.5,
                strokeOpacity: isSelected ? 1 : 0.8,
                clickable: true,
                zIndex: 2,
              }}
              onClick={() => onSelect?.(block.id)}
              onMouseOver={() => setHoveredBlock(block)}
              onMouseOut={() => setHoveredBlock(null)}
            />
          </React.Fragment>
        );
      })}
      
      {/* Info window for hovered or selected block */}
      {hoveredBlock && hoveredBlock.center && (
        <InfoWindow
          position={hoveredBlock.center}
          options={{
            pixelOffset: new google.maps.Size(0, -10),
          }}
          onCloseClick={() => setHoveredBlock(null)}
        >
          <div className="p-2 min-w-[150px]">
            <div className="text-xs text-gray-600 space-y-1">
              {/* Polyhouse name - shown first */}
              {hoveredBlock.polyhouse_name && (
                <div>
                  <span className="font-sans font-medium text-gray-900">Polyhouse:</span> {hoveredBlock.polyhouse_name}
                </div>
              )}
              {/* Elevation in meters */}
              {hoveredBlock.elevation_m !== undefined && hoveredBlock.elevation_m !== null && (
                <div>
                  <span className="font-medium text-gray-900">Elevation:</span>{' '}
                  {typeof hoveredBlock.elevation_m === 'number' 
                    ? hoveredBlock.elevation_m.toFixed(1) 
                    : hoveredBlock.elevation_m} m
                </div>
              )}
              {/* Block ID as number */}
              <div>
                <span className="font-medium text-gray-900">Block ID:</span>{' '}
                {hoveredBlock.block_number !== undefined 
                  ? hoveredBlock.block_number 
                  : (parseInt(hoveredBlock.id) || hoveredBlock.id)}
              </div>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}
