import type { 
  PlanPolyhousesRequest, 
  PlanPolyhousesResponse,
  Coordinate 
} from './types';
import { calculateOptimalOrientation } from '@/lib/utils/validation';

const API_BASE_URL = process.env.NEXT_PUBLIC_AWS_API_URL || '';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!endpoint) {
      throw new Error('Endpoint is required');
    }

    const url = `${this.baseUrl}${endpoint}`;
    
    if (!url || url === endpoint) {
      throw new Error(`Invalid API base URL. Check NEXT_PUBLIC_AWS_API_URL environment variable.`);
    }
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'An unknown error occurred',
      }));
      throw new Error(error?.message || `HTTP ${response.status}`);
    }

    const jsonResponse = await response.json().catch((err) => {
      throw new Error(`Failed to parse JSON response: ${err.message}`);
    });
    
    console.log('API Response:', jsonResponse);
    return jsonResponse;
  }

  async planPolyhouses(
    polygon: Coordinate[],
    userInstruction: string, // REQUIRED - chat message with instructions
    chatHistory?: Array<{ role: 'user' | 'system' | 'clarification'; message: string }>,
    existingPolyhouses?: any[],
    streamProgress?: boolean,
    onProgress?: (update: any) => void // Callback for progress updates
  ): Promise<PlanPolyhousesResponse> {
    // Validate input
    if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
      throw new Error('Polygon must be an array with at least 3 coordinates');
    }

    // Validate each coordinate
    for (const coord of polygon) {
      if (!coord || typeof coord.lat !== 'number' || typeof coord.lng !== 'number') {
        throw new Error('Each coordinate must have valid lat and lng numbers');
      }
    }

    // Convert polygon to GeoJSON format
    // GeoJSON requires [lng, lat] not [lat, lng]
    const coordinates = [
      polygon.map(coord => [coord.lng, coord.lat]),
    ];
    
    // Close the polygon if not already closed
    if (coordinates[0].length > 0) {
      const first = coordinates[0][0];
      const last = coordinates[0][coordinates[0].length - 1];
      if (
        first &&
        last &&
        Array.isArray(first) &&
        Array.isArray(last) &&
        first.length >= 2 &&
        last.length >= 2 &&
        (first[0] !== last[0] || first[1] !== last[1])
      ) {
        coordinates[0].push([first[0], first[1]]);
      }
    }

    // Calculate center latitude for orientation optimization
    const centerLat = polygon.reduce((sum, coord) => sum + coord.lat, 0) / polygon.length;
    const orientationConfig = calculateOptimalOrientation(centerLat);

    const request: PlanPolyhousesRequest = {
      polygon: {
        type: 'Polygon',
        coordinates,
      },
      user_instruction: userInstruction, // REQUIRED - all instructions come from chat
      chat_history: chatHistory || [],
      existing_polyhouses: existingPolyhouses || [],
      stream_progress: streamProgress || false,
      // Include center latitude and orientation configuration for backend (optional)
      center_latitude: centerLat,
      orientation_config: {
        center: orientationConfig.center,
        min: orientationConfig.min,
        max: orientationConfig.max,
        step: orientationConfig.step,
        use_pure_east_west: orientationConfig.usePureEastWest,
      },
    };

    // Make the request
    const response = await this.request<PlanPolyhousesResponse>(
      '/api/v1/plan-polyhouses',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
    
    // If streaming progress is enabled and callback provided, process progress updates
    if (streamProgress && onProgress && response.progress_updates) {
      for (const update of response.progress_updates) {
        onProgress(update);
      }
    }
    
    return response;
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
