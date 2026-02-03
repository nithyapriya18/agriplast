import { NextRequest, NextResponse } from 'next/server';

/**
 * Get current authenticated user from cookie
 * Returns user email and name if authenticated
 */
export async function GET(request: NextRequest) {
  try {
    const userEmail = request.cookies.get('agriplast_user_email')?.value;
    const userName = request.cookies.get('agriplast_user_name')?.value;

    if (!userEmail) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      email: userEmail,
      name: userName || null,
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    return NextResponse.json(
      { authenticated: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
