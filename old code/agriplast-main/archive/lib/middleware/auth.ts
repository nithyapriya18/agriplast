/**
 * Server-side authentication middleware
 * Validates user email from request headers (set by middleware)
 */

import { NextRequest } from 'next/server';

export interface AuthenticatedRequest extends NextRequest {
  userEmail?: string;
}

/**
 * Get authenticated user email from request
 * This should be set by Next.js middleware from a secure session
 */
export function getAuthenticatedUser(request: NextRequest): string | null {
  // Check for user email in headers (set by middleware)
  const userEmail = request.headers.get('x-user-email');
  
  if (!userEmail || typeof userEmail !== 'string') {
    return null;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userEmail)) {
    return null;
  }

  return userEmail;
}

/**
 * Require authentication - throws error if not authenticated
 */
export function requireAuth(request: NextRequest): string {
  const userEmail = getAuthenticatedUser(request);
  
  if (!userEmail) {
    throw new Error('Unauthorized: Authentication required');
  }

  return userEmail;
}

/**
 * Validate polygon ownership
 */
export async function validatePolygonOwnership(
  polygonId: string,
  userEmail: string
): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    return false;
  }

  try {
    const { getSql } = await import('@/lib/db');
    const sql = getSql();
    if (!sql) return false;
    
    const result = await sql`
      SELECT id
      FROM saved_polygons
      WHERE id = ${polygonId} AND user_email = ${userEmail}
      LIMIT 1
    `;

    return result && result.length > 0;
  } catch (error) {
    console.error('Error validating polygon ownership:', error);
    return false;
  }
}
