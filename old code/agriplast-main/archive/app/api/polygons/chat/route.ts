import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, validatePolygonOwnership } from '@/lib/middleware/auth';
import { validatePolygonId, validateChatMessage } from '@/lib/utils/validation';
import { getChatHistory, saveChatMessage } from '@/lib/services/chatService';

/**
 * GET /api/polygons/chat?polygonId=xxx - Get chat history for a polygon
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

    const messages = await getChatHistory(polygonId);
    return NextResponse.json({ messages });
  } catch (error: any) {
    if (error.message === 'Unauthorized: Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching chat history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/polygons/chat - Save a chat message
 */
export async function POST(request: NextRequest) {
  try {
    const userEmail = requireAuth(request);
    const body = await request.json();
    const { polygonId, versionId, role, message, metadata } = body;

    if (!polygonId || !validatePolygonId(polygonId)) {
      return NextResponse.json({ error: 'Invalid polygon ID' }, { status: 400 });
    }

    // Validate ownership
    const isOwner = await validatePolygonOwnership(polygonId, userEmail);
    if (!isOwner) {
      return NextResponse.json({ error: 'Polygon not found or access denied' }, { status: 403 });
    }

    // Validate role
    const validRoles = ['user', 'system', 'clarification'];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Validate and sanitize message
    const messageValidation = validateChatMessage(message);
    if (!messageValidation.valid) {
      return NextResponse.json(
        { error: messageValidation.error || 'Invalid message' },
        { status: 400 }
      );
    }

    const saved = await saveChatMessage(
      polygonId,
      versionId || null,
      role,
      messageValidation.sanitized!,
      metadata
    );

    if (!saved) {
      return NextResponse.json(
        { error: 'Failed to save message' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: saved });
  } catch (error: any) {
    if (error.message === 'Unauthorized: Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error saving chat message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
