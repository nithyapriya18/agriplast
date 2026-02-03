'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface AddressSearchProps {
  onPlaceSelected: (lat: number, lng: number) => void;
}

interface Prediction {
  description: string;
  place_id: string;
}

export function AddressSearch({ onPlaceSelected }: AddressSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchValue, setSearchValue] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // Initialize session token for billing optimization
  useEffect(() => {
    if (typeof google !== 'undefined' && google.maps?.places?.AutocompleteSessionToken) {
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }
  }, []);

  // Fetch predictions using NEW client-side Places API (Autocomplete Data API)
  const fetchPredictions = useCallback(async (input: string) => {
    if (!input.trim() || typeof google === 'undefined') {
      setPredictions([]);
      return;
    }

    setIsLoading(true);

    try {
      // Use NEW Places API with importLibrary
      const { AutocompleteSuggestion } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
      
      const request = {
        input: input,
        sessionToken: sessionTokenRef.current || undefined,
      };

      // Fetch autocomplete suggestions using new API
      const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
      
      if (suggestions && suggestions.length > 0) {
        setPredictions(
          suggestions.map((suggestion: any) => ({
            description: suggestion.placePrediction?.text?.toString() || '',
            place_id: suggestion.placePrediction?.placeId || '',
          }))
        );
        setShowSuggestions(true);
      } else {
        setPredictions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error fetching predictions:', error);
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    setSelectedIndex(-1);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce API calls (300ms)
    debounceTimerRef.current = setTimeout(() => {
      fetchPredictions(value);
    }, 300);
  };

  // Get place details using NEW Places API with Place class
  const selectPlace = useCallback(async (placeId: string, description: string) => {
    setSearchValue(description);
    setShowSuggestions(false);
    setPredictions([]);
    setIsLoading(true);

    try {
      if (typeof google === 'undefined') {
        throw new Error('Google Maps not loaded');
      }

      // Use NEW Places API - Place class
      const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
      
      const place = new Place({
        id: placeId,
      });

      // Fetch place details with required fields
      await place.fetchFields({
        fields: ['location', 'displayName'],
      });

      if (place.location) {
        const lat = place.location.lat();
        const lng = place.location.lng();
        onPlaceSelected(lat, lng);
        
        // Reset session token after selection (for billing)
        if (google.maps?.places?.AutocompleteSessionToken) {
          sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        }
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onPlaceSelected]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || predictions.length === 0) {
      if (e.key === 'Enter' && searchValue.trim()) {
        // If Enter pressed without suggestions, fetch and select first result
        fetchPredictions(searchValue);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < predictions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < predictions.length) {
          const selected = predictions[selectedIndex];
          selectPlace(selected.place_id, selected.description);
        } else if (predictions.length > 0) {
          // Select first suggestion if none selected
          const first = predictions[0];
          selectPlace(first.place_id, first.description);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="w-full flex justify-center px-6">
      <div className="w-[60%] relative mx-auto">
        <input
          ref={inputRef}
          type="text"
          value={searchValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (predictions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder="Search for a location..."
          className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm"
          style={{ 
            fontFamily: 'Inter, sans-serif',
            backgroundColor: 'white'
          }}
        />
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Suggestions dropdown - OPAQUE */}
        {showSuggestions && predictions.length > 0 && (
          <div
            ref={suggestionRef}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto"
            style={{ backgroundColor: 'white', opacity: 1 }}
          >
            {predictions.map((prediction, index) => (
              <div
                key={prediction.place_id}
                onClick={() => selectPlace(prediction.place_id, prediction.description)}
                className={`px-4 py-3 cursor-pointer transition-colors ${
                  index === selectedIndex
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Simple location pin icon with fixed size */}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-gray-400 flex-shrink-0"
                    style={{ minWidth: '16px', maxWidth: '16px', minHeight: '16px', maxHeight: '16px' }}
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="text-sm text-gray-700 flex-1 break-words">{prediction.description}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
