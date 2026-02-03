import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, validatePolygonOwnership } from '@/lib/middleware/auth';
import { validatePolygonId } from '@/lib/utils/validation';
import { getPolygonVersions } from '@/lib/services/polygonStorage';

/**
 * GET /api/polygons/versions?polygonId=xxx - Get all versions of a polygon
 */
export async function GET(request: NextRequest) {
  try {
    const userEmail = requireAuth(request);
    const searchParams = request.nextUrl.searchParams;
    const polygonId = searchParams.get('polygonId');

    if (!polygonId || !validatePolygonId(polygonId)) {
      return NextResponse.json({ error: 'Invalid polygon ID' }, { status: 400 });
    }

    // Validate ownership
    const isOwner = await validatePolygonOwnership(polygonId, userEmail);
    if (!isOwner) {
      return NextResponse.json({ error: 'Polygon not found or access denied' }, { status: 403 });
    }

    const versions = await getPolygonVersions(polygonId, userEmail);
    return NextResponse.json({ versions });
  } catch (error: any) {
    if (error.message === 'Unauthorized: Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching versions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
