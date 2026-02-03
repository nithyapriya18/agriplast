import { NextResponse } from 'next/server';

/**
 * Logout endpoint - clears authentication cookies
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  
  // Clear authentication cookies
  response.cookies.delete('agriplast_user_email');
  response.cookies.delete('agriplast_user_name');
  
  return response;
}
