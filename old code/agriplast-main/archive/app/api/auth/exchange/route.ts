import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { code } = body || {};

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const nextAuthUrl = process.env.NEXTAUTH_URL?.trim();
    const redirectUri = nextAuthUrl 
      ? `${nextAuthUrl}/auth/callback`
      : `${request.nextUrl.origin}/auth/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Missing Google OAuth configuration' }, { status: 500 });
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      
      // Try to parse as JSON for more details
      let errorDetails: string | object = errorData;
      try {
        errorDetails = JSON.parse(errorData);
      } catch (e) {
        // Keep errorData as string if parsing fails
      }
      
      return NextResponse.json({ 
        error: 'Failed to exchange code for token',
        details: errorDetails 
      }, { status: 500 });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;


    // Fetch user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userInfoResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch user info' }, { status: 500 });
    }

    const userInfo = await userInfoResponse.json();

    return NextResponse.json({
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
