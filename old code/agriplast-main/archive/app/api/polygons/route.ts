import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, validatePolygonOwnership } from '@/lib/middleware/auth';
import { validatePolygonId, validatePolygonCoordinates } from '@/lib/utils/validation';
import { getSavedPolygons, loadPolygon, deletePolygon } from '@/lib/services/polygonStorage';
import { checkRateLimit } from '@/lib/middleware/rateLimit';

/**
 * GET /api/polygons - Get all polygons for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const userEmail = requireAuth(request);
    
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimit = checkRateLimit(`${userEmail}:${ip}`, 200, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }
    
    const polygons = await getSavedPolygons(userEmail);
    return NextResponse.json({ polygons });
  } catch (error: any) {
    if (error.message === 'Unauthorized: Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching polygons:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/polygons - Load a specific polygon (with ownership validation)
 */
export async function POST(request: NextRequest) {
  try {
    const userEmail = requireAuth(request);
    const body = await request.json();
    const { polygonId } = body;

    if (!polygonId || !validatePolygonId(polygonId)) {
      return NextResponse.json({ error: 'Invalid polygon ID' }, { status: 400 });
    }

    // Validate ownership
    const isOwner = await validatePolygonOwnership(polygonId, userEmail);
    if (!isOwner) {
      return NextResponse.json({ error: 'Polygon not found or access denied' }, { status: 403 });
    }

    const polygon = await loadPolygon(polygonId, userEmail);
    if (!polygon) {
      return NextResponse.json({ error: 'Polygon not found' }, { status: 404 });
    }

    return NextResponse.json({ polygon });
  } catch (error: any) {
    if (error.message === 'Unauthorized: Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error loading polygon:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/polygons - Delete a polygon (with ownership validation)
 */
export async function DELETE(request: NextRequest) {
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

    const success = await deletePolygon(polygonId, userEmail);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete polygon' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized: Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting polygon:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
