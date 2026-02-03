import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/auth';
import { validatePolygonCoordinates } from '@/lib/utils/validation';
import { savePolygon } from '@/lib/services/polygonStorage';
import { checkRateLimit } from '@/lib/middleware/rateLimit';

/**
 * POST /api/polygons/save - Save a new polygon
 */
export async function POST(request: NextRequest) {
  try {
    const userEmail = requireAuth(request);
    
    // Rate limiting (prevent abuse)
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimit = checkRateLimit(`${userEmail}:${ip}`, 50, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before saving again.' },
        { status: 429 }
      );
    }
    
    const body = await request.json();
    const { coordinates, screenshot, polyhouseData } = body;

    // Validate coordinates
    if (!coordinates || !validatePolygonCoordinates(coordinates)) {
      return NextResponse.json(
        { error: 'Invalid polygon coordinates' },
        { status: 400 }
      );
    }

    // Validate screenshot if provided
    if (screenshot && typeof screenshot !== 'string') {
      return NextResponse.json(
        { error: 'Invalid screenshot format' },
        { status: 400 }
      );
    }

    // Limit screenshot size (base64 encoded)
    if (screenshot && screenshot.length > 10 * 1024 * 1024) { // 10MB
      return NextResponse.json(
        { error: 'Screenshot too large (max 10MB)' },
        { status: 400 }
      );
    }

    const saved = await savePolygon(userEmail, {
      coordinates,
      screenshot: screenshot || undefined,
      polyhouseData,
    });

    if (!saved) {
      return NextResponse.json(
        { error: 'Failed to save polygon' },
        { status: 500 }
      );
    }

    return NextResponse.json({ polygon: saved });
  } catch (error: any) {
    if (error.message === 'Unauthorized: Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error saving polygon:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
