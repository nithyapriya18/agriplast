/**
 * Input validation and sanitization utilities
 */

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Re-export checkAuth for use in API routes
 */
export async function checkAuth(email: string): Promise<boolean> {
  const { checkAuth: checkAuthFunc } = await import('@/lib/auth');
  return checkAuthFunc(email);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Sanitize string input (prevent XSS)
 */
export function sanitizeString(input: string, maxLength: number = 10000): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Trim and limit length
  let sanitized = input.trim().slice(0, maxLength);

  // Remove potentially dangerous characters
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');

  return sanitized;
}

/**
 * Validate polygon coordinates
 */
export function validatePolygonCoordinates(coordinates: any): boolean {
  if (!Array.isArray(coordinates)) {
    return false;
  }

  if (coordinates.length < 3) {
    return false;
  }

  for (const coord of coordinates) {
    if (!coord || typeof coord !== 'object') {
      return false;
    }

    const lat = coord.lat;
    const lng = coord.lng;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return false;
    }

    // Validate latitude range (-90 to 90)
    if (lat < -90 || lat > 90) {
      return false;
    }

    // Validate longitude range (-180 to 180)
    if (lng < -180 || lng > 180) {
      return false;
    }

    // Check for NaN or Infinity
    if (!isFinite(lat) || !isFinite(lng)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate polygon ID
 */
export function validatePolygonId(polygonId: string): boolean {
  if (!polygonId || typeof polygonId !== 'string') {
    return false;
  }
  return isValidUUID(polygonId);
}

/**
 * Validate chat message
 */
export function validateChatMessage(message: string): { valid: boolean; sanitized?: string; error?: string } {
  if (!message || typeof message !== 'string') {
    return { valid: false, error: 'Message is required' };
  }

  if (message.length > 5000) {
    return { valid: false, error: 'Message too long (max 5000 characters)' };
  }

  if (message.trim().length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  const sanitized = sanitizeString(message, 5000);
  return { valid: true, sanitized };
}

/**
 * Validate rule data
 */
export function validateRuleData(rule: any): boolean {
  if (!rule || typeof rule !== 'object') {
    return false;
  }

  const validRuleTypes = ['constraint', 'exclusion', 'modification'];
  if (!validRuleTypes.includes(rule.rule_type)) {
    return false;
  }

  if (!rule.rule_action || typeof rule.rule_action !== 'string') {
    return false;
  }

  if (rule.rule_action.length > 100) {
    return false;
  }

  if (!rule.rule_data || typeof rule.rule_data !== 'object') {
    return false;
  }

  return true;
}

/**
 * Calculate optimal orientation based on latitude
 * Returns orientation configuration for polyhouse placement
 */
export function calculateOptimalOrientation(latitude: number): {
  center: number;
  min: number;
  max: number;
  step: number;
  usePureEastWest: boolean;
} {
  // Clamp latitude to valid range
  const clampedLat = Math.max(-90, Math.min(90, latitude));
  
  // Pure east-west is 90 degrees
  const PURE_EAST_WEST_ANGLE = 90;
  
  // For latitudes near equator, use pure east-west
  // For higher latitudes, optimize based on sun angle
  const absLat = Math.abs(clampedLat);
  
  let center: number;
  let usePureEastWest: boolean;
  
  if (absLat < 10) {
    // Near equator: pure east-west
    center = PURE_EAST_WEST_ANGLE;
    usePureEastWest = true;
  } else if (absLat < 30) {
    // Low to mid latitudes: slight optimization
    center = PURE_EAST_WEST_ANGLE;
    usePureEastWest = true;
  } else {
    // Higher latitudes: optimize for sun angle
    // Angle varies based on latitude
    center = PURE_EAST_WEST_ANGLE + (clampedLat > 0 ? -5 : 5);
    usePureEastWest = false;
  }
  
  return {
    center,
    min: center - 15,
    max: center + 15,
    step: 5,
    usePureEastWest,
  };
}
