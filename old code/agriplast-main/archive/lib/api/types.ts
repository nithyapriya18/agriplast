export interface Coordinate {
  lat: number;
  lng: number;
}

export interface PolyhouseBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface ConnectionStats {
  angle_90: number;
  angle_180: number;
  angle_270: number;
}

export interface Polyhouse {
  id: string;
  bounds: PolyhouseBounds;
  orientation: 'NS' | 'EW' | number; // Can be NS/EW or specific angle in degrees
  connections: ConnectionStats;
  center: Coordinate;
  orientation_angle?: number; // Specific orientation angle in degrees (90 = pure east-west)
  gutter_bounds?: PolyhouseBounds; // Outer bounds including gutter border
}

export interface UnbuildableRegion {
  lat: number;
  lng: number;
  reason: string;
  type: 'unbuildable';
}

export interface PlanPolyhousesRequest {
  polygon: {
    type: 'Polygon';
    coordinates: number[][][]; // GeoJSON format
  };
  user_instruction: string; // REQUIRED - the chat message with instructions (no hardcoded defaults)
  chat_history?: Array<{
    role: 'user' | 'system' | 'clarification';
    message: string;
  }>;
  existing_polyhouses?: any[]; // Current polyhouses (for reference when excluding)
  stream_progress?: boolean; // Whether to stream progress updates
  center_latitude?: number; // Center latitude of polygon for orientation calculation
  orientation_config?: {
    center: number; // Center orientation angle (90 = pure east-west)
    min: number; // Minimum orientation angle to try
    max: number; // Maximum orientation angle to try
    step: number; // Step size for orientation optimization (degrees)
    use_pure_east_west: boolean; // Whether to use pure east-west orientation
  };
  // Legacy support - these are now extracted from user_instruction by the backend agent
  rules?: Array<{
    rule_type: 'constraint' | 'exclusion' | 'modification';
    rule_action: string;
    rule_data: any;
  }>;
}

export interface ProgressUpdate {
  step: string;
  status: 'in_progress' | 'complete' | 'error' | 'success';
  message: string;
  progress: number;
  step_number?: number;
  total_steps?: number;
  logs?: string[];
  error?: string;
}

export interface PlanPolyhousesResponse {
  success: boolean;
  stored_in_s3?: boolean;
  download_url?: string;
  expires_in_hours?: number;
  message?: string;
  progress_updates?: ProgressUpdate[]; // Progress updates from backend agent
  data?: {
    polyhouses: Polyhouse[];
    unbuildable_regions: UnbuildableRegion[];
    statistics: {
      total_polyhouses: number;
      total_blocks: number;
      total_polyhouse_groups: number;
      total_area_sqm: number;
      total_area_acres: number;
      polyhouse_area_sqm: number;
      polyhouse_area_acres: number;
      coverage_percent: number;
      connections: ConnectionStats;
    };
  };
  statistics?: {
    total_polyhouses: number;
    total_blocks: number;
    total_polyhouse_groups: number;
    total_area_sqm: number;
    total_area_acres: number;
    polyhouse_area_sqm: number;
    polyhouse_area_acres: number;
    coverage_percent: number;
    connections: ConnectionStats;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface ValidationError {
  type: 'size' | 'bounds' | 'shape';
  message: string;
}
