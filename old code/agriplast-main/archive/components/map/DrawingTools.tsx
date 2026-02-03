'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface DrawingToolsProps {
  isDrawing: boolean;
  onStartDrawing: () => void;
  onClearPolygon: () => void;
  onCalculate: () => void;
  hasPolygon: boolean;
  isCalculating: boolean;
  disabled?: boolean;
  hasResults?: boolean;
  error?: string | null;
}

export function DrawingTools({
  isDrawing,
  onStartDrawing,
  onClearPolygon,
  onCalculate,
  hasPolygon,
  isCalculating,
  disabled = false,
  hasResults = false,
  error = null,
}: DrawingToolsProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Try to find the container in the page
    const element = document.getElementById('drawing-tools-container');
    setContainer(element);
  }, []);

  const toolsContent = (
    <div className="flex flex-col items-center gap-4" style={{ pointerEvents: 'auto', zIndex: 99999, position: 'relative' }}>
      {/* Error message - show above buttons */}
      {error && hasPolygon && !hasResults && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl px-6 py-3 shadow-md max-w-md">
          <p className="text-sm font-medium text-red-800 text-center">
            Failed to calculate placement. Please try again or contact support.
          </p>
        </div>
      )}
      
      {/* Buttons container - horizontal layout with spacing */}
      {hasPolygon && !hasResults && (
        <div className="flex flex-row items-center gap-6">
          <button
            onClick={onCalculate}
            disabled={disabled || isCalculating}
            className="px-8 py-4 bg-[#4AC1FF] text-white font-sans font-semibold rounded-xl hover:bg-[#3AB0EF] active:bg-[#2AA0DF] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-md hover:shadow-lg"
            style={{ pointerEvents: 'auto', cursor: disabled || isCalculating ? 'not-allowed' : 'pointer' }}
            type="button"
          >
            {isCalculating ? 'Calculating...' : 'Calculate Placement'}
          </button>
          
          <button
            onClick={onClearPolygon}
            disabled={disabled || isCalculating}
            className="px-8 py-4 bg-white text-gray-700 font-sans font-semibold rounded-xl hover:bg-gray-50 active:bg-gray-100 border-2 border-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-md hover:shadow-lg"
            style={{ pointerEvents: 'auto', cursor: disabled || isCalculating ? 'not-allowed' : 'pointer' }}
            type="button"
          >
            Save & Clear
          </button>
        </div>
      )}
    </div>
  );

  // If container exists in the page, portal the content there
  // Otherwise, don't render (the old absolute positioning is removed)
  if (container) {
    return createPortal(toolsContent, container);
  }

  return null;
}
