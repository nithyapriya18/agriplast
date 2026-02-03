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
  const input = searchParams.get('input');
  
  if (!input) {
    return NextResponse.json({ error: 'Input parameter required' }, { status: 400 });
  }

  // Sanitize and validate input
  const sanitizedInput = sanitizeString(input, 200);
  if (sanitizedInput.length < 2) {
    return NextResponse.json({ error: 'Input too short (min 2 characters)' }, { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(sanitizedInput)}&key=${apiKey}`,
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
    console.error('Error fetching autocomplete:', error);
    return NextResponse.json({ error: 'Failed to fetch predictions' }, { status: 500 });
  }
}
