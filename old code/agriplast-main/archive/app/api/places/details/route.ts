import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/middleware/auth';
import { sanitizeString } from '@/lib/utils/validation';

export async function GET(request: NextRequest) {
  // Require authentication for Places API (to prevent abuse)
  const userEmail = getAuthenticatedUser(request);
  if (!userEmail) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const placeId = searchParams.get('place_id');
  
  if (!placeId) {
    return NextResponse.json({ error: 'place_id parameter required' }, { status: 400 });
  }

  // Sanitize place_id (should be alphanumeric with some special chars)
  const sanitizedPlaceId = sanitizeString(placeId, 200).replace(/[^a-zA-Z0-9_\-]/g, '');
  if (sanitizedPlaceId.length < 10) {
    return NextResponse.json({ error: 'Invalid place_id format' }, { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(sanitizedPlaceId)}&fields=geometry,name,formatted_address&key=${apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching place details:', error);
    return NextResponse.json({ error: 'Failed to fetch place details' }, { status: 500 });
  }
}
