'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';

interface CornerReportProps {
  corners90: number;
  corners180: number;
  corners270: number;
  totalPolyhouses: number;
  totalBlocks: number;
  totalAreaAcres: number;
  polyhouseAreaAcres: number;
  coveragePercent: number;
  onClear: () => void;
}

export function CornerReport({
  corners90,
  corners180,
  corners270,
  totalPolyhouses,
  totalBlocks,
  totalAreaAcres,
  polyhouseAreaAcres,
  coveragePercent,
  onClear,
}: CornerReportProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const element = document.getElementById('corner-report-container');
    setContainer(element);
  }, []);

  const reportContent = (
    <div className="w-full flex flex-col items-center" style={{ marginTop: '2rem' }}>
      {/* Single merged table */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-8">
        <table className="border-collapse w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-6 py-3 text-left text-sm font-mono font-semibold text-gray-700 border-b border-gray-200">
                Metric
              </th>
              <th className="px-6 py-3 text-right text-sm font-mono font-semibold text-gray-700 border-b border-gray-200">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Statistics Section */}
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-3 text-sm text-gray-900 border-b border-gray-100">
                Total Polyhouses
              </td>
              <td className="px-6 py-3 text-right text-sm font-sans font-semibold text-gray-900 border-b border-gray-100">
                {totalPolyhouses.toLocaleString()}
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-3 text-sm text-gray-900 border-b border-gray-100">
                Total Blocks
              </td>
              <td className="px-6 py-3 text-right text-sm font-sans font-semibold text-gray-900 border-b border-gray-100">
                {totalBlocks.toLocaleString()}
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-3 text-sm text-gray-900 border-b border-gray-100">
                Total Land Area
              </td>
              <td className="px-6 py-3 text-right text-sm font-sans font-semibold text-gray-900 border-b border-gray-100">
                {totalAreaAcres.toFixed(2)} acres
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-3 text-sm text-gray-900 border-b border-gray-100">
                Polyhouse Coverage
              </td>
              <td className="px-6 py-3 text-right text-sm font-sans font-semibold text-gray-900 border-b border-gray-100">
                {polyhouseAreaAcres.toFixed(2)} acres
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-3 text-sm text-gray-900 border-b border-gray-200">
                Coverage Percentage
              </td>
              <td className="px-6 py-3 text-right text-sm font-semibold text-gray-900 border-b border-gray-200">
                {coveragePercent.toFixed(1)}%
              </td>
            </tr>
            {/* Internal Corners Section */}
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-3 text-sm text-gray-900 border-b border-gray-100">
                90° Corners (L-shaped)
              </td>
              <td className="px-6 py-3 text-right text-sm font-sans font-semibold text-gray-900 border-b border-gray-100">
                {corners90.toLocaleString()}
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-3 text-sm text-gray-900 border-b border-gray-100">
                180° Straight
              </td>
              <td className="px-6 py-3 text-right text-sm font-sans font-semibold text-gray-900 border-b border-gray-100">
                {corners180.toLocaleString()}
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-3 text-sm text-gray-900">
                270° Corners (U-shaped)
              </td>
              <td className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                {corners270.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Clear Selection Button below table */}
      <Button
        variant="secondary"
        onClick={onClear}
      >
        Clear Selection
      </Button>
    </div>
  );

  if (container) {
    return createPortal(reportContent, container);
  }

  return null;
}
