import { NextRequest, NextResponse } from 'next/server';
import { isValidEmail } from '@/lib/utils/validation';
import { checkAuth } from '@/lib/auth';

/**
 * Set authentication session cookie
 * Called after OAuth callback to establish secure session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name } = body;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email' },
        { status: 400 }
      );
    }

    // Verify user is authorized
    const { checkAuth: checkAuthFunc } = await import('@/lib/auth');
    if (!checkAuthFunc(email)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Set secure HTTP-only cookie
    const response = NextResponse.json({ success: true });
    
    // Set cookie with secure flags
    response.cookies.set('agriplast_user_email', email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    if (name) {
      response.cookies.set('agriplast_user_name', name, {
        httpOnly: false, // Can be accessed by client for display
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('Error setting session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
