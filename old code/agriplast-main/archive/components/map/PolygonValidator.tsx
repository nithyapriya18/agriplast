'use client';

import React from 'react';
import { MIN_LAND_SIZE_SQM, MAX_LAND_SIZE_SQM } from '@/lib/constants';

interface ValidationError {
  type: 'size' | 'bounds' | 'shape';
  message: string;
}

interface PolygonValidatorProps {
  errors: ValidationError[];
  area?: number;
  isValid: boolean;
}

export function PolygonValidator({ errors, area, isValid }: PolygonValidatorProps) {
  if (!area && errors.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-10 max-w-sm">
      <h3 className="font-mono font-semibold text-sm text-gray-900 mb-2">
        Polygon Validation
      </h3>

      {area && (
        <div className="mb-3 pb-3 border-b border-gray-200">
          <div className="text-xs text-gray-600">Land Area</div>
          <div className="text-lg font-mono font-semibold text-gray-900">
            {area.toLocaleString()} m²
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {(area / 10000).toFixed(2)} hectares
          </div>
        </div>
      )}

      {errors.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-sm font-medium text-red-700">Issues Found</span>
          </div>
          <ul className="space-y-1">
            {errors.map((error, index) => (
              <li key={index} className="text-xs text-red-600 pl-4">
                {error.message}
              </li>
            ))}
          </ul>
          <div className="text-xs text-gray-600 mt-2 pt-2 border-t">
            <strong>Requirements:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Area: {MIN_LAND_SIZE_SQM.toLocaleString()} - {MAX_LAND_SIZE_SQM.toLocaleString()} m²</li>
              <li>Shape: Valid polygon (no self-intersections)</li>
            </ul>
          </div>
        </div>
      ) : isValid ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-lime-600 rounded-full"></div>
            <span className="text-sm font-medium text-lime-700">Valid Polygon</span>
          </div>
          <p className="text-xs text-gray-600">
            Ready to calculate Polyhouse placement
          </p>
        </div>
      ) : null}
    </div>
  );
}
