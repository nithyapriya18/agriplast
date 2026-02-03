'use client';

import React, { useState, useEffect } from 'react';
import { SavedPolygon } from '@/lib/db';
import { loadPolygon } from '@/lib/services/polygonStorage';

interface PolygonHistoryMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadPolygon: (polygon: SavedPolygon) => void;
  onNewPolygon: () => void;
  userEmail: string | null;
}

export function PolygonHistoryMenu({
  isOpen,
  onClose,
  onLoadPolygon,
  onNewPolygon,
  userEmail,
}: PolygonHistoryMenuProps) {
  const [polygons, setPolygons] = useState<SavedPolygon[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userEmail) {
      loadPolygons();
    }
  }, [isOpen, userEmail]);

  const loadPolygons = async () => {
    if (!userEmail) return;
    setLoading(true);
    try {
      // Use secure API route instead of direct database call
      const response = await fetch('/api/polygons');
      if (!response.ok) {
        throw new Error('Failed to fetch polygons');
      }
      const data = await response.json();
      setPolygons(data.polygons || []);
    } catch (error) {
      console.error('Error loading polygons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (polygonId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userEmail || !confirm('Are you sure you want to delete this polygon?')) {
      return;
    }

    setDeletingId(polygonId);
    try {
      // Use secure API route instead of direct database call
      const response = await fetch(`/api/polygons?polygonId=${encodeURIComponent(polygonId)}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete polygon');
      }

      setPolygons(polygons.filter(p => p.id !== polygonId));
    } catch (error) {
      console.error('Error deleting polygon:', error);
      alert('Failed to delete polygon. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleLoad = async (polygon: SavedPolygon) => {
    // Verify ownership via API before loading
    try {
      const response = await fetch(`/api/polygons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ polygonId: polygon.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to load polygon');
      }

      const data = await response.json();
      onLoadPolygon(data.polygon);
      onClose();
    } catch (error) {
      console.error('Error loading polygon:', error);
      alert('Failed to load polygon. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Menu */}
      <div className="fixed left-0 top-0 h-full w-80 bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="p-4 border-b border-gray-200 bg-gradient-to-b from-[#3AB0EF] via-[#4AC1FF] to-[#5AC8FF]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-mono font-bold text-[#14130B]">Polygon History</h2>
            <button
              onClick={onClose}
              className="text-[#14130B] hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </button>
          </div>
          <button
            onClick={() => {
              onNewPolygon();
              onClose();
            }}
            className="w-full py-2 px-4 bg-[#14130B] text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
          >
            New
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading...</p>
            </div>
          ) : polygons.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No saved polygons yet.</p>
              <p className="text-sm mt-2">Create and save a polygon to see it here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {polygons.map((polygon) => (
                <div
                  key={polygon.id}
                  onClick={() => handleLoad(polygon)}
                  className="border border-gray-200 rounded-lg p-3 hover:border-primary hover:shadow-md cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono font-semibold text-gray-900">
                          {polygon.polygon_number?.toString() || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(polygon.created_at)}
                        </span>
                      </div>
                      
                      {polygon.screenshot_data && (
                        <img
                          src={polygon.screenshot_data}
                          alt={`Polygon ${polygon.polygon_number?.toString() || 'Unknown'}`}
                          className="w-full h-32 object-cover rounded border border-gray-200 mb-2"
                        />
                      )}
                      
                      <div className="text-xs text-gray-600">
                        {polygon.polygon_coordinates.length} points
                        {polygon.polyhouse_data && (
                          <span className="ml-2">
                            • {polygon.polyhouse_data.polyhouses?.length || 0} blocks
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => handleDelete(polygon.id, e)}
                      disabled={deletingId === polygon.id}
                      className="text-red-500 hover:text-red-700 disabled:opacity-50 p-1"
                      title="Delete"
                    >
                      {deletingId === polygon.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
