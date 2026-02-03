'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';

interface ConnectionStats {
  angle_90: number;
  angle_180: number;
  angle_270: number;
}

interface ResultsPanelProps {
  totalPolyhouses: number;
  totalBlocks: number;
  totalPolyhouseGroups: number;
  totalArea: number;
  totalAreaAcres: number;
  PolyhouseArea: number;
  polyhouseAreaAcres: number;
  coveragePercent: number;
  connections: ConnectionStats;
  selectedPolyhouse?: {
    id: string;
    orientation: 'NS' | 'EW';
    connections: ConnectionStats;
  } | null;
  onExport?: () => void;
  onClose?: () => void;
}

export function ResultsPanel({
  totalPolyhouses,
  totalBlocks,
  totalPolyhouseGroups,
  totalArea,
  totalAreaAcres,
  PolyhouseArea,
  polyhouseAreaAcres,
  coveragePercent,
  connections,
  selectedPolyhouse,
  onExport,
  onClose,
}: ResultsPanelProps) {
  // Debug logging to check what values are being received
  console.log('ResultsPanel props:', {
    totalPolyhouses,
    totalBlocks,
    totalPolyhouseGroups,
    totalAreaAcres,
    polyhouseAreaAcres,
    coveragePercent,
    connections,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-mono font-semibold text-sm text-[#FFFFFD]">
          Placement Results
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {selectedPolyhouse ? (
        <div className="space-y-3">
          <div className="pb-3 border-b border-[#FFFFFD]/10">
            <div className="text-xs text-gray-500 mb-1">Selected Polyhouse</div>
            <div className="text-sm font-sans font-medium text-[#FFFFFD]">ID: {selectedPolyhouse.id}</div>
            <div className="text-sm text-gray-400">
              Orientation: {selectedPolyhouse.orientation === 'NS' ? 'North-South' : 'East-West'}
            </div>
          </div>

          <div>
            <div className="text-xs font-mono font-semibold text-gray-400 mb-2">Connections</div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">90° (L-shaped)</span>
                <span className="font-sans font-medium text-[#FFFFFD]">{selectedPolyhouse.connections.angle_90}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">180° (Straight)</span>
                <span className="font-medium text-[#FFFFFD]">{selectedPolyhouse.connections.angle_180}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">270° (U-shaped)</span>
                <span className="font-medium text-[#FFFFFD]">{selectedPolyhouse.connections.angle_270}</span>
              </div>
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={() => onClose?.()}
            className="w-full"
          >
            Back to Overview
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Polyhouses</span>
              <span className="font-sans font-medium text-[#FFFFFD]">{totalPolyhouseGroups}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Blocks</span>
              <span className="font-medium text-[#FFFFFD]">{totalBlocks}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Land Area</span>
              <span className="font-medium text-[#FFFFFD]">{(totalAreaAcres ?? 0).toFixed(2)} acres</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Polyhouse Coverage</span>
              <span className="font-medium text-[#FFFFFD]">{(polyhouseAreaAcres ?? 0).toFixed(2)} acres</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Coverage Percentage</span>
              <span className="font-medium text-[#FFFFFD]">{(coveragePercent ?? 0).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">90° Internal Corners</span>
              <span className="font-medium text-[#FFFFFD]">{connections?.angle_90 ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">180° Straight Internal</span>
              <span className="font-medium text-[#FFFFFD]">{connections?.angle_180 ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">270° Internal Corners</span>
              <span className="font-medium text-[#FFFFFD]">{connections?.angle_270 ?? 0}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
