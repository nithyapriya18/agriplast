'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { GoogleMap as GoogleMapReact, useJsApiLoader, Polygon } from '@react-google-maps/api';
import { DEFAULT_CENTER, MAP_CONFIG, COLORS } from '@/lib/constants';
import { usePolygonDrawing } from '@/hooks/usePolygonDrawing';
import { usePolyhousePlanning } from '@/hooks/usePolyhousePlanning';
import { DrawingTools } from './DrawingTools';
import { PolygonValidator } from './PolygonValidator';
import { ResultsPanel } from './ResultsPanel';
import { PolyhouseOverlay } from './PolyhouseOverlay';
import { BuildableOverlay } from './BuildableOverlay';
import { ProgressPopup } from './ProgressPopup';
import { CornerReport } from './CornerReport';
import { captureMapScreenshot, createPolygonVersion } from '@/lib/services/polygonStorage';
import { SavedPolygon } from '@/lib/db';
import { getDefaultInitialChatMessage, getDefaultInitialChatMessagePreview } from '@/lib/services/defaultRules';
import { saveChatMessage } from '@/lib/services/chatService';

// Include places and marker libraries
const libraries: ("geometry" | "places" | "marker")[] = ["geometry", "places", "marker"];

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

interface GoogleMapProps {
  center?: {lat: number, lng: number} | null;
  polygonId?: string;
  initialPolygon?: SavedPolygon | null;
  onPolygonIdChange?: (polygonId: string | null) => void;
  onVersionIdChange?: (versionId: string | null) => void;
  onChatMessage?: (message: string) => Promise<void>;
  chatInputRef?: React.RefObject<HTMLTextAreaElement | null>;
  chatMessageHandlerRef?: React.MutableRefObject<((message: string) => Promise<void>) | null>;
  userEmail?: string | null;
  onStatisticsChange?: (statistics: any) => void;
  onPolyhousesChange?: (polyhouses: any[]) => void;
  onSelectedPolyhouseChange?: (id: string | null) => void;
  onStartDrawingRequest?: React.MutableRefObject<(() => void) | null>;
  onClearPolygonRequest?: React.MutableRefObject<(() => Promise<void>) | null>;
  onCalculateRequest?: React.MutableRefObject<(() => Promise<void>) | null>;
  isDrawingRef?: React.MutableRefObject<boolean>;
  isCalculatingRef?: React.MutableRefObject<boolean>;
}

const PROGRESS_STEPS = [
  'Loading DEM data from S3...',
  'Calculating terrain slope...',
  'Loading land cover data...',
  'Identifying water bodies...',
  'Creating buildable mask...',
  'Placing polyhouses...',
  'Analyzing connections...',
  'Finalizing results...',
];

export function GoogleMap({ 
  center: propCenter, 
  polygonId, 
  initialPolygon,
  onPolygonIdChange,
  onVersionIdChange,
  onChatMessage,
  chatInputRef,
  chatMessageHandlerRef,
  userEmail: propUserEmail,
  onStatisticsChange,
  onPolyhousesChange,
  onSelectedPolyhouseChange,
  onStartDrawingRequest,
  onClearPolygonRequest,
  onCalculateRequest,
  isDrawingRef,
  isCalculatingRef,
}: GoogleMapProps) {
  const [mapCenter, setMapCenter] = useState({
    lat: DEFAULT_CENTER.lat,
    lng: DEFAULT_CENTER.lng,
  });
  const mapRef = useRef<google.maps.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false); // Track when map is loaded
  const [tempPolygonPoints, setTempPolygonPoints] = useState<Array<{lat: number, lng: number}>>([]);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const tempMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const polygonMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>(MAP_CONFIG.MAP_TYPE);
  
  // Progress tracking
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [progressUpdates, setProgressUpdates] = useState<any[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(propUserEmail || null);
  
  // Update userEmail if prop changes
  useEffect(() => {
    if (propUserEmail) {
      setUserEmail(propUserEmail);
    }
  }, [propUserEmail]);

  // Get user email from API (reads from HTTP-only cookie)
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.email) {
            setUserEmail(data.email);
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    fetchUser();
  }, []);

  // Try to get user's location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setMapCenter(userLocation);
          if (mapRef.current) {
            mapRef.current.panTo(userLocation);
            mapRef.current.setZoom(14);
          }
        },
        (error) => {
          // Silently fall back to default location
        },
        { timeout: 5000 }
      );
    }
  }, []);

  // Update map center when prop changes (from search)
  useEffect(() => {
    if (propCenter && mapRef.current) {
      mapRef.current.panTo(propCenter);
      mapRef.current.setZoom(15);
    }
  }, [propCenter]);

  const {
    polygon,
    isDrawing,
    errors,
    area,
    isValid,
    startDrawing,
    updatePolygon,
    clearPolygon,
  } = usePolygonDrawing();

  const {
    polyhouses,
    unbuildableRegions,
    statistics,
    isCalculating,
    error,
    selectedPolyhouseId,
    selectedPolyhouse,
    calculatePlacement,
    applyRulesAndRecalculate,
    clearResults,
    selectPolyhouse,
    deselectPolyhouse,
    currentPolygon,
    appliedRules,
    restorePolyhouseData,
  } = usePolyhousePlanning();

  // Expose statistics and polyhouses to parent
  useEffect(() => {
    if (onStatisticsChange) {
      onStatisticsChange(statistics);
    }
  }, [statistics, onStatisticsChange]);

  useEffect(() => {
    if (onPolyhousesChange) {
      onPolyhousesChange(polyhouses);
    }
  }, [polyhouses, onPolyhousesChange]);

  useEffect(() => {
    if (onSelectedPolyhouseChange) {
      onSelectedPolyhouseChange(selectedPolyhouseId);
    }
  }, [selectedPolyhouseId, onSelectedPolyhouseChange]);

  // Expose drawing and calculating state to parent
  useEffect(() => {
    if (isDrawingRef) {
      isDrawingRef.current = isDrawing;
    }
  }, [isDrawing, isDrawingRef]);

  useEffect(() => {
    if (isCalculatingRef) {
      isCalculatingRef.current = isCalculating;
    }
  }, [isCalculating, isCalculatingRef]);

  // Expose handlers to parent via ref props - moved after function definitions

  // Version management state
  const [currentPolygonId, setCurrentPolygonId] = useState<string | null>(null);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [polygonVersions, setPolygonVersions] = useState<SavedPolygon[]>([]);
  const [pendingSave, setPendingSave] = useState<boolean>(false);
  const [hasZoomedToPolygon, setHasZoomedToPolygon] = useState(false);
  const [pendingRuleApplication, setPendingRuleApplication] = useState<{
    userInstruction: string;
    versionComment: string;
    chatHistory?: Array<{ role: 'user' | 'system' | 'clarification'; message: string }>;
  } | null>(null);
  
  // Expose a method to trigger recalculation from chat messages
  const handleChatMessage = useCallback(async (message: string) => {
    if (!currentPolygonId || !currentVersionId || !userEmail || !polygon || polygon.length < 3) {
      console.warn('Cannot process chat message: missing polygon or polygon not valid');
      return;
    }

    // Get chat history for context
    const { getChatHistory } = await import('@/lib/services/chatService');
    const chatHistory = await getChatHistory(currentPolygonId);
    const chatHistoryArray = chatHistory.map(msg => ({
      role: msg.role,
      message: msg.message,
    }));

    // Trigger recalculation with the new message
    setPendingRuleApplication({
      userInstruction: message,
      versionComment: `User instruction: ${message.substring(0, 50)}...`,
      chatHistory: chatHistoryArray,
    });
  }, [currentPolygonId, currentVersionId, userEmail, polygon]);
  
  // Expose handler to parent via ref prop
  useEffect(() => {
    if (chatMessageHandlerRef) {
      chatMessageHandlerRef.current = handleChatMessage;
    }
  }, [handleChatMessage, chatMessageHandlerRef]);

  // Save initial polygon when statistics become available after first calculation
  useEffect(() => {
    if (pendingSave && statistics && polyhouses.length > 0 && userEmail && !currentPolygonId && polygon.length >= 3) {
      const saveInitialPolygon = async () => {
        try {
          const screenshot = await captureMapScreenshot();
          // Use secure API route instead of direct database call
          const saveResponse = await fetch('/api/polygons/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              coordinates: polygon,
              screenshot: screenshot || undefined,
              polyhouseData: {
                polyhouses: polyhouses,
                statistics: statistics,
                unbuildable_regions: unbuildableRegions,
              },
            }),
          });

          if (!saveResponse.ok) {
            throw new Error('Failed to save polygon');
          }

          const saveData = await saveResponse.json();
          const saved = saveData.polygon;
          
          if (saved) {
            setCurrentPolygonId(saved.id);
            setCurrentVersionId(saved.id);
            onPolygonIdChange?.(saved.id);
            onVersionIdChange?.(saved.id);
            setPendingSave(false);
            await loadVersions();
            
            // Auto-zoom to the saved polygon
            if (mapRef.current && typeof google !== 'undefined' && polygon.length >= 3) {
              const bounds = new google.maps.LatLngBounds();
              polygon.forEach((coord) => {
                bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
              });
              mapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
            }
            
            // Save the initial default chat message (the comprehensive instruction)
            const defaultInitialMessage = getDefaultInitialChatMessage();
            
            await fetch('/api/polygons/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                polygonId: saved.id,
                versionId: saved.id,
                role: 'user',
                message: defaultInitialMessage,
                metadata: { is_initial: true },
              }),
            });
            
            // Also save system response
            await fetch('/api/polygons/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                polygonId: saved.id,
                versionId: saved.id,
                role: 'system',
                message: 'Initial polyhouse layout calculated based on your instructions.',
                metadata: { calculation_complete: true },
              }),
            });
          }
        } catch (error) {
          console.error('Error saving initial polygon:', error);
        }
      };
      
      saveInitialPolygon();
    }
  }, [pendingSave, statistics, polyhouses, userEmail, currentPolygonId, polygon, unbuildableRegions]);

  // Save version after rule application completes
  useEffect(() => {
    if (pendingRuleApplication && statistics && polyhouses.length > 0 && currentVersionId && userEmail && polygon) {
      const saveVersionAfterRules = async () => {
        try {
          setProgress(90);
          setCurrentStep('Saving new version...');

          const screenshot = await captureMapScreenshot();
          
          // Get the user instruction from pendingRuleApplication
          const userInstruction = pendingRuleApplication.userInstruction || 'User modification';
          
          // Create version - rules are now extracted from the instruction by the backend
          const newVersion = await createPolygonVersion(
            currentVersionId,
            userEmail,
            {
              coordinates: polygon,
              screenshot: screenshot || undefined,
              polyhouseData: {
                polyhouses: polyhouses,
                statistics: statistics,
                unbuildable_regions: unbuildableRegions,
              },
            },
            pendingRuleApplication.versionComment
          );

          if (newVersion) {
            setCurrentVersionId(newVersion.id);
            await loadVersions();
          }

          setProgress(100);
          setCurrentStep('Complete!');
          setTimeout(() => {
            setShowProgress(false);
            setPendingRuleApplication(null);
          }, 1000);
        } catch (error) {
          console.error('Error saving version after rules:', error);
          setShowProgress(false);
          setPendingRuleApplication(null);
        }
      };

      saveVersionAfterRules();
    }
  }, [pendingRuleApplication, statistics, polyhouses, currentVersionId, userEmail, polygon, unbuildableRegions]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim(),
    libraries,
  });

  // Load initial polygon if provided
  useEffect(() => {
    if (initialPolygon && initialPolygon.polygon_coordinates && initialPolygon.polygon_coordinates.length >= 3) {
      updatePolygon(initialPolygon.polygon_coordinates);
      setCurrentPolygonId(initialPolygon.id);
      const versionId = initialPolygon.is_current_version ? initialPolygon.id : initialPolygon.id;
      setCurrentVersionId(versionId);
      onPolygonIdChange?.(initialPolygon.id);
      onVersionIdChange?.(versionId);
      
      // Restore polyhouse data if available
      if (initialPolygon.polyhouse_data && restorePolyhouseData) {
        restorePolyhouseData(initialPolygon.polyhouse_data);
      }
      
      // Auto-zoom to polygon bounds
      if (mapRef.current && typeof google !== 'undefined' && isMapReady) {
        const bounds = new google.maps.LatLngBounds();
        initialPolygon.polygon_coordinates.forEach((coord: {lat: number, lng: number}) => {
          bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
        });
        
        // Add padding for better view
        const padding = { top: 50, right: 50, bottom: 50, left: 50 };
        mapRef.current.fitBounds(bounds, padding);
      }
      
      // Load versions
      if (userEmail) {
        loadVersions();
      }
    }
  }, [initialPolygon, userEmail, updatePolygon, restorePolyhouseData, isMapReady]);

  // Auto-zoom to polygon when it's first created (when reaching 3 points)
  useEffect(() => {
    if (polygon.length >= 3 && mapRef.current && typeof google !== 'undefined' && isMapReady && !initialPolygon && !currentPolygonId && !hasZoomedToPolygon) {
      // Auto-zoom when polygon first becomes valid (3+ points)
      const bounds = new google.maps.LatLngBounds();
      polygon.forEach((coord) => {
        bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
      });
      
      // Fit bounds with padding
      mapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      setHasZoomedToPolygon(true);
    }
    
    // Reset zoom flag when polygon is cleared
    if (polygon.length < 3) {
      setHasZoomedToPolygon(false);
    }
  }, [polygon.length, isMapReady, currentPolygonId, initialPolygon, hasZoomedToPolygon]);

  // Manual polygon drawing using click events - allow unlimited points
  useEffect(() => {
    if (!mapRef.current || !isMapReady || !isDrawing || typeof google === 'undefined') {
      // Remove click listener if not drawing
      if (clickListenerRef.current && google?.maps?.event) {
        google.maps.event.removeListener(clickListenerRef.current);
        clickListenerRef.current = null;
      }
      return;
    }
    
    // Add click listener for drawing
    clickListenerRef.current = mapRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;

      const newPoint = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      };

      // If polygon already has 3+ points, add to existing polygon
      if (polygon.length >= 3) {
        updatePolygon([...polygon, newPoint]);
      } else {
        // Otherwise add to temp points
        setTempPolygonPoints(prev => {
          const updated = [...prev, newPoint];
          
          // Auto-convert to polygon when we have 3 points
          if (updated.length === 3) {
            updatePolygon(updated);
            return [];
          }
          
          return updated;
        });
      }
    });

    return () => {
      if (clickListenerRef.current && google?.maps?.event) {
        google.maps.event.removeListener(clickListenerRef.current);
        clickListenerRef.current = null;
      }
    };
  }, [isDrawing, polygon, updatePolygon, isMapReady]);

  // Handle marker drag to update point position - updates the main polygon
  const handleMarkerDragEnd = useCallback((index: number, newLat: number, newLng: number) => {
    if (polygon.length >= 3) {
      const updated = [...polygon];
      updated[index] = { lat: newLat, lng: newLng };
      updatePolygon(updated);
    }
  }, [polygon, updatePolygon]);

  // Handle right-click to remove point - updates the main polygon
  const handleMarkerRightClick = useCallback((index: number) => {
    if (polygon.length > 3) { // Only allow removing if more than 3 points
      const updated = [...polygon];
      updated.splice(index, 1);
      updatePolygon(updated);
    }
  }, [polygon, updatePolygon]);

  // Handle double-click to finish polygon
  useEffect(() => {
    if (!mapRef.current || !isDrawing || tempPolygonPoints.length < 3 || typeof google === 'undefined') return;

    const dblClickListener = mapRef.current.addListener('dblclick', () => {
      if (tempPolygonPoints.length >= 3) {
        updatePolygon(tempPolygonPoints);
        setTempPolygonPoints([]);
      }
    });

    return () => {
      if (google?.maps?.event) {
        google.maps.event.removeListener(dblClickListener);
      }
    };
  }, [isDrawing, tempPolygonPoints, updatePolygon]);

  // Create AdvancedMarkerElements for temporary points
  useEffect(() => {
    const createTempMarkers = async () => {
      // Clean up old markers
      tempMarkersRef.current.forEach(marker => {
        marker.map = null;
      });
      tempMarkersRef.current = [];

      if (!mapRef.current || !isMapReady || typeof google === 'undefined' || tempPolygonPoints.length === 0 || tempPolygonPoints.length >= 3) {
        return;
      }

      try {
        const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

        tempPolygonPoints.forEach((point, index) => {
          // Create pin element with red color
          const pinElement = new PinElement({
            background: '#FF0000',
            borderColor: '#FFFFFF',
            glyphColor: '#FFFFFF',
            scale: 1.2,
          });

          const marker = new AdvancedMarkerElement({
            map: mapRef.current,
            position: point,
            content: pinElement.element,
            gmpDraggable: true,
            title: `Point ${index + 1}`,
          });

          // Handle drag events - update position without recreating markers
          marker.addListener('drag', (e: any) => {
            if (e.latLng) {
              const newLat = e.latLng.lat();
              const newLng = e.latLng.lng();
              // Update marker position directly
              marker.position = { lat: newLat, lng: newLng };
            }
          });

          marker.addListener('dragend', (e: any) => {
            if (e.latLng) {
              setTempPolygonPoints(prev => {
                const updated = [...prev];
                updated[index] = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                return updated;
              });
            }
          });

          // Handle right-click to delete
          marker.addListener('contextmenu', (e: any) => {
            e.domEvent?.preventDefault?.();
            setTempPolygonPoints(prev => {
              const updated = [...prev];
              updated.splice(index, 1);
              return updated;
            });
          });

          tempMarkersRef.current.push(marker);
        });
      } catch (error) {
        console.error('Error creating temp markers:', error);
      }
    };

    createTempMarkers();

    return () => {
      tempMarkersRef.current.forEach(marker => {
        marker.map = null;
      });
      tempMarkersRef.current = [];
    };
  }, [tempPolygonPoints.length, isMapReady]); // Only recreate when length changes

  // Create AdvancedMarkerElements for polygon vertices
  useEffect(() => {
    const createPolygonMarkers = async () => {
      // Clean up old markers
      polygonMarkersRef.current.forEach(marker => {
        marker.map = null;
      });
      polygonMarkersRef.current = [];

      if (!mapRef.current || !isMapReady || typeof google === 'undefined' || polygon.length < 3 || statistics) {
        return;
      }

      try {
        const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

        polygon.forEach((point, index) => {
          const isFirstPoint = index === 0;
          const isLastPoint = index === polygon.length - 1;
          const markerColor = isFirstPoint ? '#00FF00' : isLastPoint ? '#FFA500' : COLORS.primary;

          // Create pin element with appropriate color
          const pinElement = new PinElement({
            background: markerColor,
            borderColor: '#FFFFFF',
            glyphColor: '#FFFFFF',
            scale: 1.2,
          });

          const marker = new AdvancedMarkerElement({
            map: mapRef.current,
            position: point,
            content: pinElement.element,
            gmpDraggable: true,
            title: `Vertex ${index + 1}`,
          });

          // Handle drag events - update position without recreating markers
          marker.addListener('drag', (e: any) => {
            if (e.latLng) {
              const newLat = e.latLng.lat();
              const newLng = e.latLng.lng();
              // Update marker position directly
              marker.position = { lat: newLat, lng: newLng };
            }
          });

          marker.addListener('dragend', (e: any) => {
            if (e.latLng) {
              handleMarkerDragEnd(index, e.latLng.lat(), e.latLng.lng());
            }
          });

          // Handle right-click to delete
          marker.addListener('contextmenu', (e: any) => {
            e.domEvent?.preventDefault?.();
            handleMarkerRightClick(index);
          });

          polygonMarkersRef.current.push(marker);
        });
      } catch (error) {
        console.error('Error creating polygon markers:', error);
      }
    };

    createPolygonMarkers();

    return () => {
      polygonMarkersRef.current.forEach(marker => {
        marker.map = null;
      });
      polygonMarkersRef.current = [];
    };
  }, [polygon.length, isMapReady, statistics]); // Only recreate when length changes

  const handleClear = useCallback(async () => {
    // Save polygon before clearing if we have one
    if (polygon && polygon.length >= 3 && userEmail) {
      try {
        const screenshot = await captureMapScreenshot();
        // Use secure API route
        const response = await fetch('/api/polygons/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coordinates: polygon,
            screenshot: screenshot || undefined,
            polyhouseData: statistics ? {
              polyhouses: polyhouses,
              statistics: statistics,
              unbuildable_regions: unbuildableRegions,
            } : undefined,
          }),
        });
        
        if (response.ok) {
          console.log('Polygon saved successfully');
        } else {
          console.error('Failed to save polygon:', await response.text());
        }
      } catch (error) {
        console.error('Error saving polygon:', error);
        // Continue with clear even if save fails
      }
    }
    
    clearPolygon();
    clearResults();
    setTempPolygonPoints([]);
    setHasZoomedToPolygon(false);
  }, [clearPolygon, clearResults, polygon, userEmail, statistics, polyhouses, unbuildableRegions]);

  const handleLoadPolygon = useCallback((savedPolygon: SavedPolygon) => {
    // Load the polygon coordinates
    updatePolygon(savedPolygon.polygon_coordinates);
    
    // Set polygon and version IDs
    setCurrentPolygonId(savedPolygon.id);
    setCurrentVersionId(savedPolygon.is_current_version ? savedPolygon.id : savedPolygon.id);
    
    // Load versions via API
    if (userEmail) {
      fetch(`/api/polygons/versions?polygonId=${encodeURIComponent(savedPolygon.id)}`)
        .then(res => res.json())
        .then(data => setPolygonVersions(data.versions || []))
        .catch(err => console.error('Error loading versions:', err));
    }
    
    // If there's polyhouse data, we need to restore it
    // This would require updating the polyhouse planning hook
    // For now, just load the polygon and user can recalculate if needed
    if (savedPolygon.polyhouse_data) {
      // TODO: Restore polyhouse data to state
      console.log('Polyhouse data available:', savedPolygon.polyhouse_data);
    }
    
    // Center map on polygon
    if (savedPolygon.polygon_coordinates.length > 0) {
      const center = savedPolygon.polygon_coordinates.reduce(
        (acc, coord) => ({
          lat: acc.lat + coord.lat,
          lng: acc.lng + coord.lng,
        }),
        { lat: 0, lng: 0 }
      );
      center.lat /= savedPolygon.polygon_coordinates.length;
      center.lng /= savedPolygon.polygon_coordinates.length;
      
      setMapCenter(center);
      if (mapRef.current) {
        mapRef.current.panTo(center);
        mapRef.current.setZoom(15);
      }
    }
  }, [updatePolygon, userEmail]);

  const handleNewPolygon = useCallback(() => {
    clearPolygon();
    clearResults();
    setTempPolygonPoints([]);
    setCurrentPolygonId(null);
    setCurrentVersionId(null);
    setPolygonVersions([]);
    setPendingSave(false);
    setHasZoomedToPolygon(false);
    startDrawing();
    // Reset map to default view
    if (mapRef.current) {
      mapRef.current.setCenter(DEFAULT_CENTER);
      mapRef.current.setZoom(MAP_CONFIG.DEFAULT_ZOOM);
    }
  }, [clearPolygon, clearResults, startDrawing]);

  // Load versions when polygonId changes
  useEffect(() => {
    if (currentPolygonId && userEmail) {
      loadVersions();
    }
  }, [currentPolygonId, userEmail]);

  const loadVersions = async () => {
    if (!currentPolygonId || !userEmail) return;
    try {
      const response = await fetch(`/api/polygons/versions?polygonId=${encodeURIComponent(currentPolygonId)}`);
      if (!response.ok) {
        throw new Error('Failed to load versions');
      }
      const data = await response.json();
      setPolygonVersions(data.versions || []);
    } catch (error) {
      console.error('Error loading versions:', error);
    }
  };

  // Handle applying rules from chat - now takes user instruction (chat message) instead of rules
  const handleApplyRules = useCallback(async (
    userInstruction: string, // The chat message with instructions
    versionComment: string,
    chatHistory?: Array<{ role: 'user' | 'system' | 'clarification'; message: string }>
  ) => {
    if (!currentPolygonId || !currentVersionId || !userEmail || !polygon) {
      throw new Error('Missing required data for applying rules');
    }

    setShowProgress(true);
    setProgress(0);
    setCurrentStep('Analyzing your instructions...');

    try {
      // Track progress updates from backend
      const progressUpdates: any[] = [];
      const handleProgress = (update: any) => {
        progressUpdates.push(update);
        if (update.progress !== undefined) {
          setProgress(update.progress);
        }
        if (update.message) {
          setCurrentStep(update.message);
        }
        // Log backend progress
        if (update.logs && Array.isArray(update.logs)) {
          console.log('Backend logs:', update.logs);
        }
      };
      
      // Apply instruction and recalculate (this is async and will update state)
      await applyRulesAndRecalculate(userInstruction, chatHistory, handleProgress);

      // Set pending rule application - useEffect will handle saving when state updates
      setPendingRuleApplication({
        userInstruction,
        versionComment,
        chatHistory,
      });

      // The useEffect will handle the rest when statistics/polyhouses update
    } catch (error) {
      console.error('Error applying rules:', error);
      setShowProgress(false);
      setPendingRuleApplication(null);
      throw error;
    }
  }, [currentPolygonId, currentVersionId, userEmail, polygon, statistics, polyhouses, unbuildableRegions, applyRulesAndRecalculate]);

  // Handle reverting to a previous version
  const handleRevert = useCallback(async (versionId: string) => {
    if (!userEmail || !polygon) return;

    // Get the chat history for this version to reconstruct the instruction
    const { getVersionChatHistory } = await import('@/lib/services/chatService');
    const versionChatHistory = await getVersionChatHistory(versionId);
    
    // Find the user message that triggered this version
    const userMessage = versionChatHistory.find(msg => msg.role === 'user');
    if (!userMessage) {
      throw new Error('Could not find user instruction for this version');
    }

    // Recalculate with that instruction
    setShowProgress(true);
    setProgress(0);
    setCurrentStep('Reverting to previous version...');
    
    try {
      // Track progress
      const handleProgress = (update: any) => {
        if (update.progress !== undefined) {
          setProgress(update.progress);
        }
        if (update.message) {
          setCurrentStep(update.message);
        }
      };
      
      await applyRulesAndRecalculate(userMessage.message, versionChatHistory, handleProgress);
      
      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create a new version (revert creates a new version, doesn't modify old one)
      // Note: createPolygonVersion validates ownership server-side
      const screenshot = await captureMapScreenshot();
      const newVersion = await createPolygonVersion(
        versionId,
        userEmail,
        {
          coordinates: polygon,
          screenshot: screenshot || undefined,
          polyhouseData: statistics ? {
            polyhouses: polyhouses,
            statistics: statistics,
            unbuildable_regions: unbuildableRegions,
          } : undefined,
        },
        `Reverted to version ${versionId}`
      );

      if (newVersion) {
        setCurrentVersionId(newVersion.id);
        await loadVersions();
      }
      
      setShowProgress(false);
    } catch (error) {
      console.error('Error reverting:', error);
      setShowProgress(false);
      throw error;
    }
  }, [userEmail, polygon, statistics, polyhouses, unbuildableRegions, applyRulesAndRecalculate]);

  const handleCalculate = useCallback(async () => {
    if (isValid && polygon.length >= 3) {
      // Show progress popup
      setShowProgress(true);
      setProgress(0);
      
      // Simulate progress through steps
      const stepDuration = 1000; // 1 second per step
      const progressPerStep = 100 / PROGRESS_STEPS.length;
      
      let currentStepIndex = 0;
      const progressInterval = setInterval(() => {
        if (currentStepIndex < PROGRESS_STEPS.length) {
          setCurrentStep(PROGRESS_STEPS[currentStepIndex]);
          setProgress((currentStepIndex + 1) * progressPerStep);
          currentStepIndex++;
        }
      }, stepDuration);

      // Safety timeout to ensure we don't get stuck calculating
      const timeoutId = setTimeout(() => {
        clearInterval(progressInterval);
        setShowProgress(false);
        console.error('Calculation timed out after 2 minutes');
      }, 120000); // 2 minute timeout

      try {
        // Get the comprehensive default initial chat message
        // This is the ONLY way to initiate polyhouse placement - no hardcoded defaults
        const defaultInitialMessage = getDefaultInitialChatMessage();
        
        // Clear the simulated progress interval - we'll use real progress from backend
        clearInterval(progressInterval);
        clearTimeout(timeoutId);
        
        // Track progress updates from backend
        const updates: any[] = [];
        const handleProgress = (update: any) => {
          updates.push(update);
          setProgressUpdates([...updates]);
          if (update.progress !== undefined) {
            setProgress(update.progress);
          }
          if (update.message) {
            setCurrentStep(update.message);
          }
          // Log backend progress for debugging
          if (update.logs && Array.isArray(update.logs)) {
            console.log('Backend logs:', update.logs);
          }
        };
        
        // Calculate with the default initial message (all instructions come from chat)
        await calculatePlacement(
          polygon,
          defaultInitialMessage, // REQUIRED - all instructions come from this message
          [], // No chat history for initial calculation
          handleProgress
        );
        
        setProgress(100);
        setCurrentStep('Complete!');
        setLastError(null);
        
        // Mark that we need to save (will be handled by useEffect when statistics are available)
        if (userEmail && !currentPolygonId) {
          setPendingSave(true);
        }
        
        // Auto-close after 1 second
        setTimeout(() => {
          setShowProgress(false);
          setProgressUpdates([]);
        }, 1000);
      } catch (error) {
        console.error('Calculation error:', error);
        clearInterval(progressInterval);
        clearTimeout(timeoutId);
        const errorMessage = error instanceof Error ? error.message : 'An error occurred during calculation';
        setLastError(errorMessage);
        setShowProgress(true); // Keep popup open to show error and retry button
        setPendingSave(false);
      }
    }
  }, [isValid, polygon, calculatePlacement, userEmail, currentPolygonId, currentVersionId]);

  // Expose handlers to parent via ref props (after function definitions)
  useEffect(() => {
    if (onStartDrawingRequest) {
      onStartDrawingRequest.current = startDrawing;
    }
  }, [startDrawing, onStartDrawingRequest]);

  useEffect(() => {
    if (onClearPolygonRequest) {
      onClearPolygonRequest.current = handleClear;
    }
  }, [handleClear, onClearPolygonRequest]);

  useEffect(() => {
    if (onCalculateRequest) {
      onCalculateRequest.current = handleCalculate;
    }
  }, [handleCalculate, onCalculateRequest]);

  const handleExport = useCallback(() => {
    if (!statistics) return;

    const data = {
      statistics,
      polyhouses: polyhouses.map(gh => ({
        id: gh.id,
        bounds: gh.bounds,
        orientation: gh.orientation,
        connections: gh.connections,
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agriplast-results-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [statistics, polyhouses]);

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="font-body text-gray-600">Loading Google Maps...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full" id="google-map-container">

      <GoogleMapReact
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={MAP_CONFIG.DEFAULT_ZOOM}
        onLoad={(map) => {
          mapRef.current = map;
          setIsMapReady(true);
          
          // Listen for map type changes to keep state in sync
          map.addListener('maptypeid_changed', () => {
            const newMapTypeId = map.getMapTypeId() as 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
            setMapTypeId(newMapTypeId);
          });
        }}
        options={{
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || 'agriplast-map',
          minZoom: MAP_CONFIG.MIN_ZOOM,
          maxZoom: MAP_CONFIG.MAX_ZOOM,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          disableDoubleClickZoom: isDrawing,
        }}
      >
        {/* Temporary polygon being drawn */}
        {isDrawing && tempPolygonPoints.length >= 2 && (
          <Polygon
            paths={tempPolygonPoints}
            options={{
              fillColor: COLORS.primary,
              fillOpacity: 0.2,
              strokeColor: COLORS.primary,
              strokeWeight: 3,
              editable: false,
              draggable: false,
              clickable: false,
            }}
          />
        )}

        {/* User's completed polygon - always visible */}
        {isLoaded && typeof google !== 'undefined' && polygon && Array.isArray(polygon) && polygon.length >= 3 && (
          <Polygon
            paths={polygon}
            options={{
              fillColor: COLORS.primary,
              fillOpacity: statistics ? 0.05 : 0.15,  // More transparent when showing results
              strokeColor: COLORS.primary,
              strokeWeight: 3,
              editable: false,
              draggable: false,
              clickable: false,
            }}
          />
        )}

        {/* Results overlays */}
        {statistics && (
          <>
            <BuildableOverlay regions={unbuildableRegions} visible={true} />
            <PolyhouseOverlay
              polyhouses={polyhouses}
              selectedId={selectedPolyhouseId || undefined}
              onSelect={selectPolyhouse}
            />
          </>
        )}
      </GoogleMapReact>

      {/* Initial Instructions Overlay - show when no polygon and no results */}
      {isDrawing && polygon.length === 0 && !statistics && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg px-6 py-4 max-w-md z-10 border-2 border-primary/20">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                Click on the map to draw your land boundary
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Need at least 3 points to create a polygon
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Drawing Tools, Validation Panel removed - now handled by MapChatArea component */}

      {/* Chat Panel, Results Panel, Drawing Tools, etc. removed - now handled by MapChatArea component */}

      {/* Progress Popup */}
        <ProgressPopup
          isOpen={showProgress}
          progress={progress}
          currentStep={currentStep}
          progressUpdates={progressUpdates}
          error={lastError}
          onClose={() => {
            setShowProgress(false);
            setLastError(null);
            setProgressUpdates([]);
          }}
          onRetry={lastError ? () => {
            setLastError(null);
            setProgressUpdates([]);
            handleCalculate();
          } : undefined}
        />

      {/* Corner Report removed - now handled by MapChatArea component */}
    </div>
  );
}
